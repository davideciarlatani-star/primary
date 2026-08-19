from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# ----------------------------- Models -----------------------------

class Profile(BaseModel):
    age_range: str = "26-35"        # 18-25, 26-35, 36-50, 51-67, 67+
    region: str = "Lazio"
    employment: str = "dipendente"  # dipendente, autonomo, disoccupato, studente, pensionato, mai_dichiarato
    household_size: int = 1
    children: int = 0
    children_under_3: int = 0
    isee_range: str = "10-25"        # 0-10, 10-25, 25-40, 40+, unknown
    home_owner: bool = False
    renting: bool = False
    disability: bool = False
    has_filed: bool = True           # ha mai presentato dichiarazioni

class SimInput(BaseModel):
    profile: Profile
    annual_income: float = 20000     # reddito lordo annuo stimato

# ----------------------------- Bonus Catalog -----------------------------
# Catalogo curato di aiuti/bonus statali italiani (dati indicativi 2025-2026).

def isee_min(p: Profile) -> float:
    return {"0-10": 5000, "10-25": 17500, "25-40": 32500, "40+": 45000, "unknown": 20000}.get(p.isee_range, 20000)

BONUSES = [
    {
        "id": "assegno-unico",
        "name": "Assegno Unico Universale",
        "category": "Famiglia",
        "icon": "people",
        "short": "Contributo mensile per ogni figlio a carico.",
        "description": "Sostegno economico erogato dall'INPS per ogni figlio a carico fino ai 21 anni (senza limiti in caso di disabilità). L'importo varia in base all'ISEE del nucleo familiare.",
        "amount": "da 57 € a 199 € al mese per figlio",
        "deadline": "2026-02-28",
        "deadline_note": "La domanda può essere presentata tutto l'anno; rinnovo entro il 28 febbraio.",
        "how": "Domanda online sul portale INPS con SPID/CIE, tramite CAF o patronato.",
        "source": "INPS",
        "rule": lambda p: p.children > 0,
        "why": "Hai figli a carico nel nucleo familiare.",
        "declaration": "Domanda telematica INPS dedicata — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-asilo-nido",
        "name": "Bonus Asilo Nido",
        "category": "Famiglia",
        "icon": "school",
        "short": "Rimborso rette asilo nido e forme di supporto domiciliare.",
        "description": "Contributo per il pagamento delle rette di asili nido pubblici e privati per bambini sotto i 3 anni. L'importo massimo dipende dall'ISEE minorenni.",
        "amount": "fino a 3.600 € all'anno",
        "deadline": "2026-12-31",
        "deadline_note": "Domanda entro il 31 dicembre dell'anno di riferimento.",
        "how": "Domanda online INPS allegando le ricevute di pagamento della retta.",
        "source": "INPS",
        "rule": lambda p: p.children_under_3 > 0,
        "why": "Hai figli sotto i 3 anni.",
        "declaration": "Domanda telematica INPS dedicata con ricevute — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "carta-dedicata-a-te",
        "name": "Carta Dedicata a Te",
        "category": "Reddito basso",
        "icon": "card",
        "short": "Carta prepagata per acquisto beni di prima necessità.",
        "description": "Carta prepagata una tantum destinata ai nuclei familiari con ISEE basso per l'acquisto di beni alimentari e carburanti.",
        "amount": "500 € una tantum",
        "deadline": "2026-12-16",
        "deadline_note": "Assegnata automaticamente dai Comuni; da attivare entro le scadenze annuali.",
        "how": "Nessuna domanda: i beneficiari sono individuati da INPS e Comuni in base all'ISEE.",
        "source": "INPS / Comuni",
        "rule": lambda p: p.isee_range == "0-10" and p.household_size >= 3,
        "why": "Nucleo familiare numeroso con ISEE basso.",
        "declaration": "Nessuna domanda: assegnazione automatica in base all'ISEE (DSU).",
        "apply_url": "https://www.lavoro.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "assegno-inclusione",
        "name": "Assegno di Inclusione (ADI)",
        "category": "Reddito basso",
        "icon": "hand-left",
        "short": "Sostegno al reddito per nuclei fragili.",
        "description": "Misura di sostegno economico per nuclei familiari con ISEE fino a 10.140 € che includono minori, over 60 o persone con disabilità, condizionata all'adesione a un percorso di inclusione.",
        "amount": "fino a 500 € al mese (+ contributo affitto)",
        "deadline": "2026-12-31",
        "deadline_note": "Domanda in qualsiasi momento; rinnovo dopo 18 mesi.",
        "how": "Domanda online INPS con SPID/CIE o tramite patronato, con sottoscrizione del Patto di attivazione.",
        "source": "INPS",
        "rule": lambda p: p.isee_range == "0-10" and (p.children > 0 or p.disability or p.age_range in ("51-67", "67+")),
        "why": "ISEE molto basso con presenza di minori, disabilità o over 60.",
        "declaration": "Domanda INPS + Patto di attivazione — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "naspi",
        "name": "NASpI - Indennità di disoccupazione",
        "category": "Lavoro",
        "icon": "briefcase",
        "short": "Indennità mensile per chi ha perso il lavoro.",
        "description": "Indennità mensile di disoccupazione per lavoratori dipendenti che hanno perso involontariamente il lavoro e hanno versato i contributi richiesti.",
        "amount": "circa il 75% dell'ultimo stipendio",
        "deadline": "2026-03-31",
        "deadline_note": "Domanda entro 68 giorni dalla cessazione del rapporto di lavoro.",
        "how": "Domanda online INPS con SPID/CIE, CAF o patronato.",
        "source": "INPS",
        "rule": lambda p: p.employment == "disoccupato",
        "why": "Risulti attualmente disoccupato.",
        "declaration": "Domanda telematica INPS dedicata — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-affitto-giovani",
        "name": "Detrazione Affitto Giovani",
        "category": "Casa",
        "icon": "home",
        "short": "Detrazione per giovani under 31 in affitto.",
        "description": "Detrazione IRPEF per i giovani tra 20 e 31 anni che stipulano un contratto di locazione per l'abitazione principale, con reddito complessivo non superiore a 15.493,71 €.",
        "amount": "fino a 2.000 € di detrazione",
        "deadline": "2026-09-30",
        "deadline_note": "Da indicare nella dichiarazione dei redditi (730/Redditi PF).",
        "how": "Inserimento nella dichiarazione dei redditi allegando il contratto di locazione registrato.",
        "source": "Agenzia delle Entrate",
        "rule": lambda p: p.age_range in ("18-25", "26-35") and p.renting and p.isee_range in ("0-10", "10-25"),
        "why": "Sei giovane, in affitto e con reddito contenuto.",
        "declaration": "Va inserita nella dichiarazione dei redditi (730 o Redditi PF).",
        "apply_url": "https://www.agenziaentrate.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-ristrutturazioni",
        "name": "Bonus Ristrutturazioni",
        "category": "Casa",
        "icon": "construct",
        "short": "Detrazione 50% sui lavori di ristrutturazione.",
        "description": "Detrazione IRPEF sulle spese per interventi di recupero del patrimonio edilizio sull'abitazione di proprietà, ripartita in 10 quote annuali.",
        "amount": "detrazione 50% (max 96.000 € di spesa)",
        "deadline": "2026-12-31",
        "deadline_note": "Valida per le spese sostenute nell'anno; recupero in dichiarazione.",
        "how": "Pagamenti con bonifico parlante e inserimento delle spese in dichiarazione dei redditi.",
        "source": "Agenzia delle Entrate",
        "rule": lambda p: p.home_owner and p.has_filed,
        "why": "Sei proprietario di un immobile.",
        "declaration": "Va inserita nella dichiarazione dei redditi (730 o Redditi PF).",
        "apply_url": "https://www.agenziaentrate.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-elettrodomestici",
        "name": "Bonus Elettrodomestici",
        "category": "Casa",
        "icon": "flash",
        "short": "Contributo per elettrodomestici ad alta efficienza.",
        "description": "Contributo per l'acquisto di elettrodomestici ad alta efficienza energetica prodotti in UE, con rottamazione del vecchio apparecchio. Maggiorato per ISEE basso.",
        "amount": "fino a 100 € (200 € con ISEE < 25.000 €)",
        "deadline": "2026-12-31",
        "deadline_note": "Fino a esaurimento fondi tramite piattaforma dedicata.",
        "how": "Voucher richiesto tramite app/piattaforma governativa dedicata al momento dell'acquisto.",
        "source": "Ministero delle Imprese",
        "rule": lambda p: True,
        "why": "Disponibile per tutti i residenti che acquistano elettrodomestici efficienti.",
        "declaration": "Voucher su piattaforma dedicata — nessuna dichiarazione.",
        "apply_url": "https://www.mimit.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-psicologo",
        "name": "Bonus Psicologo",
        "category": "Salute",
        "icon": "medkit",
        "short": "Contributo per sedute di psicoterapia.",
        "description": "Contributo per sostenere le spese di sedute di psicoterapia presso professionisti iscritti all'albo, con importo variabile in base all'ISEE.",
        "amount": "fino a 1.500 € (ISEE < 15.000 €)",
        "deadline": "2026-11-30",
        "deadline_note": "Domanda nella finestra annuale INPS, fino a esaurimento fondi.",
        "how": "Domanda online INPS con SPID/CIE nella finestra prevista.",
        "source": "INPS",
        "rule": lambda p: p.isee_range in ("0-10", "10-25", "25-40"),
        "why": "Rientri nelle soglie ISEE previste per il contributo.",
        "declaration": "Domanda telematica INPS dedicata — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "carta-cultura-giovani",
        "name": "Carta Cultura Giovani",
        "category": "Giovani",
        "icon": "book",
        "short": "500 € per i 18enni per cultura e formazione.",
        "description": "Bonus di 500 € per i ragazzi che compiono 18 anni appartenenti a nuclei con ISEE non superiore a 35.000 €, spendibile in libri, musei, cinema, concerti e corsi.",
        "amount": "500 € una tantum",
        "deadline": "2026-06-30",
        "deadline_note": "Registrazione entro le scadenze dell'anno del 18° compleanno.",
        "how": "Registrazione sull'app/portale dedicato con SPID.",
        "source": "Ministero della Cultura",
        "rule": lambda p: p.age_range == "18-25" and p.isee_range in ("0-10", "10-25", "25-40"),
        "why": "Sei un giovane con ISEE entro la soglia prevista.",
        "declaration": "Registrazione sul portale dedicato — nessuna dichiarazione.",
        "apply_url": "https://cartagiovani.cultura.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-mamme",
        "name": "Bonus Mamme Lavoratrici",
        "category": "Lavoro",
        "icon": "woman",
        "short": "Esonero contributivo per madri lavoratrici.",
        "description": "Esonero parziale dei contributi previdenziali per le lavoratrici madri con almeno due figli, con vantaggio in busta paga.",
        "amount": "fino a 3.000 € all'anno di risparmio contributivo",
        "deadline": "2026-12-31",
        "deadline_note": "Applicato in busta paga previa comunicazione al datore di lavoro.",
        "how": "Comunicazione al datore di lavoro dei codici fiscali dei figli.",
        "source": "INPS",
        "rule": lambda p: p.children >= 2 and p.employment in ("dipendente", "autonomo"),
        "why": "Hai due o più figli e sei lavoratrice/lavoratore.",
        "declaration": "Comunicazione al datore di lavoro — nessuna dichiarazione.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "detrazione-spese-mediche",
        "name": "Detrazione Spese Mediche",
        "category": "Salute",
        "icon": "pulse",
        "short": "Recupero 19% sulle spese sanitarie.",
        "description": "Detrazione IRPEF del 19% sulle spese sanitarie sostenute che superano la franchigia di 129,11 €, da indicare nella dichiarazione dei redditi.",
        "amount": "19% delle spese oltre 129,11 €",
        "deadline": "2026-09-30",
        "deadline_note": "Recupero tramite dichiarazione dei redditi annuale.",
        "how": "Conservare scontrini/fatture e inserire le spese nel 730 o Redditi PF.",
        "source": "Agenzia delle Entrate",
        "rule": lambda p: p.has_filed,
        "why": "Puoi recuperare parte delle spese sanitarie in dichiarazione.",
        "declaration": "Va inserita nella dichiarazione dei redditi (730 o Redditi PF).",
        "apply_url": "https://www.agenziaentrate.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-sociale-bollette",
        "name": "Bonus Sociale Bollette",
        "category": "Reddito basso",
        "icon": "flash-outline",
        "short": "Sconto automatico su luce, gas e acqua.",
        "description": "Sconto in bolletta per elettricità, gas e servizio idrico riconosciuto ai nuclei con ISEE basso o numerosi. Erogato automaticamente in fattura.",
        "amount": "fino a circa 500 € all'anno",
        "deadline": "2026-12-31",
        "deadline_note": "Riconosciuto automaticamente per tutto l'anno in cui l'ISEE è valido.",
        "how": "Nessuna domanda: presentare la DSU per l'ISEE aggiornato; lo sconto arriva in automatico in bolletta.",
        "source": "ARERA / INPS",
        "rule": lambda p: p.isee_range == "0-10" or (p.isee_range == "10-25" and p.children >= 3),
        "why": "Rientri nelle soglie ISEE del bonus sociale.",
        "declaration": "Automatico con ISEE (DSU) — nessuna domanda specifica.",
        "apply_url": "https://www.arera.it/it/bonus_sociale.htm",
        "region_scope": "Nazionale",
    },
    {
        "id": "carta-acquisti",
        "name": "Carta Acquisti",
        "category": "Reddito basso",
        "icon": "card-outline",
        "short": "Carta da 40 €/mese per over 65 e bimbi sotto i 3 anni.",
        "description": "Carta prepagata per il sostegno alla spesa alimentare e sanitaria e al pagamento delle bollette, riservata ad anziani over 65 e a famiglie con bambini sotto i 3 anni in condizioni di disagio economico.",
        "amount": "80 € ogni bimestre",
        "deadline": "2026-12-31",
        "deadline_note": "Domanda in qualsiasi momento presso gli uffici postali.",
        "how": "Domanda con modulo dedicato presso gli uffici di Poste Italiane o online.",
        "source": "INPS / Poste Italiane",
        "rule": lambda p: (p.age_range == "67+" or p.children_under_3 > 0) and p.isee_range == "0-10",
        "why": "Hai over 65 o bimbi piccoli con ISEE molto basso.",
        "declaration": "Domanda con modulo dedicato presso Poste/INPS — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-nuovi-nati",
        "name": "Bonus Nuove Nascite",
        "category": "Famiglia",
        "icon": "gift-outline",
        "short": "1.000 € una tantum per ogni nuovo nato.",
        "description": "Contributo una tantum per la nascita o adozione di un figlio, riconosciuto ai nuclei con ISEE non superiore a 40.000 €.",
        "amount": "1.000 € una tantum",
        "deadline": "2026-12-31",
        "deadline_note": "Domanda entro 60 giorni dalla nascita/adozione.",
        "how": "Domanda telematica sul portale INPS con SPID/CIE o tramite patronato.",
        "source": "INPS",
        "rule": lambda p: p.children_under_3 > 0 and p.isee_range in ("0-10", "10-25", "25-40"),
        "why": "Hai un figlio nato di recente e ISEE entro 40.000 €.",
        "declaration": "Domanda telematica INPS dedicata — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "assegno-maternita-comuni",
        "name": "Assegno di Maternità dei Comuni",
        "category": "Famiglia",
        "icon": "woman-outline",
        "short": "Assegno per mamme senza altra indennità.",
        "description": "Assegno erogato dai Comuni (pagato da INPS) alle madri che non beneficiano di altre indennità di maternità, con ISEE entro la soglia annuale.",
        "amount": "circa 2.000 € (5 mensilità)",
        "deadline": "2026-10-31",
        "deadline_note": "Domanda entro 6 mesi dalla nascita del figlio.",
        "how": "Domanda al Comune di residenza allegando ISEE e documentazione.",
        "source": "Comuni / INPS",
        "rule": lambda p: p.children_under_3 > 0 and p.isee_range == "0-10" and p.employment in ("disoccupato", "studente", "mai_dichiarato"),
        "why": "Hai un figlio piccolo e non ricevi altra indennità di maternità.",
        "declaration": "Domanda al Comune di residenza — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "detrazione-istruzione",
        "name": "Detrazione Spese di Istruzione",
        "category": "Giovani",
        "icon": "school-outline",
        "short": "Recupero 19% su scuola e università.",
        "description": "Detrazione IRPEF del 19% sulle spese per istruzione scolastica e universitaria (tasse, mensa, iscrizioni), entro i limiti annuali previsti.",
        "amount": "19% delle spese (fino a 800 €/anno per figlio a scuola)",
        "deadline": "2026-09-30",
        "deadline_note": "Recupero tramite dichiarazione dei redditi annuale.",
        "how": "Conservare le ricevute e inserire le spese nel 730 o Redditi PF.",
        "source": "Agenzia delle Entrate",
        "rule": lambda p: p.has_filed and (p.children > 0 or p.age_range == "18-25"),
        "why": "Hai spese di istruzione detraibili per te o per i figli.",
        "declaration": "Va inserita nella dichiarazione dei redditi (730 o Redditi PF).",
        "apply_url": "https://www.agenziaentrate.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-barriere",
        "name": "Bonus Barriere Architettoniche",
        "category": "Casa",
        "icon": "accessibility-outline",
        "short": "Detrazione 75% per abbattere le barriere.",
        "description": "Detrazione IRPEF del 75% sulle spese per interventi di eliminazione delle barriere architettoniche (rampe, montascale, ascensori) negli edifici esistenti.",
        "amount": "detrazione 75% delle spese",
        "deadline": "2026-12-31",
        "deadline_note": "Valida per le spese sostenute nell'anno; recupero in dichiarazione.",
        "how": "Pagamento con bonifico parlante e inserimento delle spese in dichiarazione.",
        "source": "Agenzia delle Entrate",
        "rule": lambda p: (p.home_owner or p.disability) and p.has_filed,
        "why": "Sei proprietario o hai disabilità nel nucleo: interventi agevolati al 75%.",
        "declaration": "Va inserita in dichiarazione (730/Redditi PF) + bonifico dedicato.",
        "apply_url": "https://www.agenziaentrate.gov.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "reddito-liberta",
        "name": "Reddito di Libertà",
        "category": "Reddito basso",
        "icon": "heart-outline",
        "short": "Contributo per donne vittime di violenza.",
        "description": "Contributo mensile a favore delle donne vittime di violenza seguite dai centri antiviolenza, per favorire l'autonomia e l'indipendenza economica.",
        "amount": "fino a 500 € al mese per 12 mesi",
        "deadline": "2026-12-31",
        "deadline_note": "Domanda in qualsiasi momento tramite i servizi sociali.",
        "how": "Domanda all'INPS tramite i servizi sociali del Comune e il centro antiviolenza di riferimento.",
        "source": "INPS / Comuni",
        "rule": lambda p: False,
        "why": "Misura dedicata alle donne vittime di violenza seguite dai centri antiviolenza.",
        "declaration": "Domanda tramite servizi sociali del Comune — non serve il 730.",
        "apply_url": "https://www.inps.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "borsa-studio-regionale",
        "name": "Borsa di Studio Regionale (DSU)",
        "category": "Giovani",
        "icon": "ribbon-outline",
        "short": "Diritto allo studio universitario per regione.",
        "description": "Borsa di studio e servizi (alloggio, mensa) erogati dagli enti regionali per il diritto allo studio universitario, in base a reddito ISEE e merito. Ogni regione ha un proprio bando.",
        "amount": "da 2.000 € a 7.000 € all'anno",
        "deadline": "2026-09-15",
        "deadline_note": "Bando regionale annuale, di solito tra agosto e settembre.",
        "how": "Domanda sul portale dell'ente regionale per il diritto allo studio della tua regione.",
        "source": "Enti Regionali per il Diritto allo Studio",
        "rule": lambda p: p.age_range in ("18-25", "26-35") and p.employment == "studente" and p.isee_range in ("0-10", "10-25"),
        "why": "Sei uno studente con ISEE entro le soglie regionali.",
        "declaration": "Domanda al portale regionale per il diritto allo studio — non è il 730.",
        "apply_url": "https://www.mur.gov.it",
        "region_scope": "Nazionale (bando per singola regione)",
    },
    {
        "id": "dote-scuola-lombardia",
        "name": "Dote Scuola (Lombardia)",
        "category": "Famiglia",
        "icon": "book-outline",
        "short": "Contributo regionale per i libri e la scuola.",
        "description": "Contributo di Regione Lombardia per l'acquisto di libri di testo, dotazioni tecnologiche e materiale didattico per studenti residenti in Lombardia, in base all'ISEE.",
        "amount": "da 100 € a 300 € per studente",
        "deadline": "2026-06-20",
        "deadline_note": "Bando regionale annuale, di norma in primavera.",
        "how": "Domanda sul portale Bandi Online di Regione Lombardia con SPID/CIE.",
        "source": "Regione Lombardia",
        "rule": lambda p: p.region == "Lombardia" and p.children > 0 and p.isee_range in ("0-10", "10-25"),
        "why": "Risiedi in Lombardia con figli a scuola e ISEE entro la soglia.",
        "declaration": "Domanda su Bandi Online Regione Lombardia — non serve il 730.",
        "apply_url": "https://www.bandi.regione.lombardia.it",
        "region_scope": "Lombardia",
    },
    {
        "id": "contributo-affitto-regionale",
        "name": "Contributo Affitto (Fondo Regionale)",
        "category": "Casa",
        "icon": "home-outline",
        "short": "Sostegno regionale al pagamento dell'affitto.",
        "description": "Contributo per il pagamento del canone di locazione erogato tramite fondi regionali e comunali, destinato agli inquilini con ISEE basso. Importi e bandi variano per regione.",
        "amount": "fino a circa 2.000 € all'anno",
        "deadline": "2026-11-30",
        "deadline_note": "Bando regionale/comunale periodico, verifica le aperture nella tua zona.",
        "how": "Domanda al Comune di residenza o sul portale della tua Regione durante il bando.",
        "source": "Regioni / Comuni",
        "rule": lambda p: p.renting and p.isee_range in ("0-10", "10-25"),
        "why": "Sei in affitto con ISEE contenuto: puoi accedere al fondo regionale.",
        "declaration": "Domanda al Comune/portale regionale — non serve il 730.",
        "apply_url": "https://www.mit.gov.it",
        "region_scope": "Nazionale (bando per singola regione)",
    },
]

def public_bonus(b: dict, profile: Optional[Profile] = None) -> dict:
    out = {k: v for k, v in b.items() if k != "rule"}
    if profile is not None:
        out["eligible"] = bool(b["rule"](profile))
    return out

# ----------------------------- Routes -----------------------------

@api_router.get("/")
async def root():
    return {"message": "BonusRadar API"}

@api_router.get("/bonuses")
async def list_bonuses():
    return {"bonuses": [public_bonus(b) for b in BONUSES]}

@api_router.get("/bonus/{bonus_id}")
async def get_bonus(bonus_id: str):
    for b in BONUSES:
        if b["id"] == bonus_id:
            return public_bonus(b)
    raise HTTPException(status_code=404, detail="Bonus non trovato")

@api_router.post("/match")
async def match_bonuses(profile: Profile):
    eligible, others = [], []
    for b in BONUSES:
        item = public_bonus(b, profile)
        (eligible if item["eligible"] else others).append(item)
    return {"eligible": eligible, "others": others, "eligible_count": len(eligible)}

@api_router.post("/calendar")
async def calendar(profile: Profile):
    items = []
    for b in BONUSES:
        if b["rule"](profile):
            items.append({
                "id": b["id"],
                "name": b["name"],
                "category": b["category"],
                "icon": b["icon"],
                "deadline": b["deadline"],
                "deadline_note": b["deadline_note"],
                "amount": b["amount"],
            })
    items.sort(key=lambda x: x["deadline"])
    return {"deadlines": items}


async def _ask_llm(system: str, prompt: str) -> Optional[str]:
    if not EMERGENT_LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=system,
        ).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(text=prompt))
        return resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return None


def _parse_json(text: str):
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


@api_router.post("/ai/suggest")
async def ai_suggest(profile: Profile):
    eligible = [public_bonus(b, profile) for b in BONUSES if b["rule"](profile)]
    names = ", ".join(b["name"] for b in eligible) or "nessun bonus rilevato"
    system = ("Sei un consulente esperto di welfare e agevolazioni fiscali italiane. "
              "Rispondi SEMPRE ed ESCLUSIVAMENTE in italiano con un JSON valido.")
    prompt = (
        f"Profilo utente: fascia età {profile.age_range}, regione {profile.region}, "
        f"occupazione {profile.employment}, nucleo di {profile.household_size} persone, "
        f"{profile.children} figli ({profile.children_under_3} sotto i 3 anni), "
        f"ISEE fascia {profile.isee_range} mila €, "
        f"{'proprietario casa' if profile.home_owner else 'non proprietario'}, "
        f"{'in affitto' if profile.renting else 'non in affitto'}, "
        f"{'con disabilità nel nucleo' if profile.disability else 'senza disabilità'}. "
        f"Bonus a cui risulta idoneo: {names}. "
        "Restituisci un JSON con questa struttura esatta: "
        '{"headline": "titolo breve e motivante max 8 parole", '
        '"summary": "2-3 frasi che riassumono la situazione dell\'utente e il potenziale complessivo", '
        '"tips": ["3 consigli pratici e specifici su come massimizzare gli aiuti"], '
        '"priority": "nome del bonus più urgente/vantaggioso da richiedere subito"}'
    )
    parsed = _parse_json(await _ask_llm(system, prompt) or "")
    if not parsed:
        parsed = {
            "headline": f"{len(eligible)} agevolazioni disponibili per te",
            "summary": f"In base al tuo profilo potresti avere diritto a {len(eligible)} tra bonus e agevolazioni statali. Completa le domande entro le scadenze per non perdere gli importi.",
            "tips": [
                "Richiedi lo SPID o la CIE per accedere ai portali INPS e Agenzia delle Entrate.",
                "Aggiorna il tuo ISEE all'inizio dell'anno per sbloccare più agevolazioni.",
                "Conserva ricevute e fatture: molte detrazioni si recuperano in dichiarazione.",
            ],
            "priority": eligible[0]["name"] if eligible else "Nessuno",
        }
    parsed["eligible_count"] = len(eligible)
    return parsed


@api_router.post("/simulate")
async def simulate(data: SimInput):
    p = data.profile
    eligible = [public_bonus(b, p) for b in BONUSES if b["rule"](p)]
    # Fallback rule-based estimate
    base = 0
    for b in eligible:
        digits = re.findall(r"(\d[\d\.]*)", b["amount"].replace(".", ""))
        if digits:
            base += min(int(digits[0]), 4000)
    rule_estimate = base if base else 1500

    system = ("Sei un consulente fiscale italiano. Aiuti chi non ha mai presentato dichiarazioni "
              "a capire i vantaggi economici del mettersi in regola. Rispondi SOLO con JSON valido in italiano.")
    prompt = (
        f"Un cittadino che non ha mai presentato dichiarazioni dei redditi ha un reddito annuo stimato di {int(data.annual_income)} €. "
        f"Profilo: età {p.age_range}, {p.children} figli, ISEE fascia {p.isee_range}, "
        f"{'proprietario' if p.home_owner else 'non proprietario'}, {'in affitto' if p.renting else 'non in affitto'}. "
        f"Bonus potenzialmente accessibili una volta in regola: {', '.join(b['name'] for b in eligible) or 'agevolazioni base'}. "
        "Stima in modo realistico e prudente il vantaggio economico annuo. Restituisci JSON esatto: "
        '{"current_situation": "1-2 frasi sulla situazione attuale di chi non dichiara", '
        '"estimated_annual_gain": numero_intero_euro, '
        '"breakdown": [{"label": "voce", "amount": numero_euro, "detail": "2-3 frasi che spiegano questa voce: chi ne ha diritto, come si ottiene e perché conviene"}], '
        '"conclusion": "1-2 frasi motivanti sul mettersi in regola"}'
    )
    parsed = _parse_json(await _ask_llm(system, prompt) or "")
    if not parsed or "estimated_annual_gain" not in parsed:
        parsed = {
            "current_situation": "Non presentando dichiarazioni rinunci a bonus, detrazioni e rimborsi a cui avresti diritto, oltre a rischiare sanzioni.",
            "estimated_annual_gain": rule_estimate,
            "breakdown": [{"label": b["name"], "amount": min(int(re.findall(r'(\d[\d\.]*)', b['amount'].replace('.', ''))[0]) if re.findall(r'(\d[\d\.]*)', b['amount'].replace('.', '')) else 500, 4000), "detail": f"{b['description']} {b['how']}"} for b in eligible[:5]] or [{"label": "Agevolazioni base", "amount": rule_estimate, "detail": "Mettendoti in regola sblocchi l'accesso alle agevolazioni statali di base legate al reddito e all'ISEE."}],
            "conclusion": "Mettendoti in regola potresti recuperare somme importanti ogni anno e accedere in sicurezza al welfare statale.",
        }
    try:
        parsed["estimated_annual_gain"] = int(parsed["estimated_annual_gain"])
    except Exception:
        parsed["estimated_annual_gain"] = rule_estimate
    return parsed


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
