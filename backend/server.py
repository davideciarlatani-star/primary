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
        "apply_url": "https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.assegno-unico-e-universale-per-i-figli-a-carico-55984.assegno-unico-e-universale-per-i-figli-a-carico.html",
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
        "apply_url": "https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.bonus-asilo-nido-e-forme-di-supporto-presso-la-propria-abitazione-51105.bonus-asilo-nido-e-forme-di-supporto-presso-la-propria-abitazione.html",
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
        "apply_url": "",
        "apply_note": "Nessuna domanda: assegnazione automatica in base all'ISEE tramite INPS e Comune di residenza.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite CAF o patronato (invio telematico INPS); poi iscrizione al portale SIISL per il Patto di Attivazione.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite CAF o patronato (invio telematico all'INPS), entro 68 giorni dalla cessazione.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite dichiarazione dei redditi (730/Redditi PF) con CAF o commercialista.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite dichiarazione dei redditi con CAF o commercialista (pagamento con bonifico parlante).",
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
        "apply_url": "https://bonuselettrodomestici.it",
        "region_scope": "Nazionale",
    },
    {
        "id": "bonus-psicologo",
        "name": "Bonus Psicologo",
        "category": "Salute",
        "icon": "medkit",
        "short": "Contributo per sedute di psicoterapia.",
        "description": "Contributo per sostenere le spese di sedute di psicoterapia presso professionisti iscritti all'albo. Copre fino a 50 € a seduta, con un tetto complessivo che varia in base all'ISEE: fino a 1.500 € (ISEE < 15.000 €), 1.000 € (ISEE 15.000-30.000 €) o 500 € (ISEE 30.000-50.000 €).",
        "amount": "fino a 1.500 € (max 50 €/seduta, in base all'ISEE)",
        "deadline": "2026-11-30",
        "deadline_note": "Domanda nella finestra annuale INPS, fino a esaurimento fondi.",
        "how": "Domanda online INPS con SPID/CIE nella finestra prevista.",
        "source": "INPS",
        "rule": lambda p: p.isee_range in ("0-10", "10-25", "25-40"),
        "why": "Rientri nelle soglie ISEE previste per il contributo.",
        "declaration": "Domanda telematica INPS dedicata — non serve il 730.",
        "apply_url": "https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.contributo-per-sostenere-le-spese-relative-a-sessioni-di-psicoterapia-bonus-psicologo.html",
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
        "apply_url": "https://cartegiovani.cultura.gov.it",
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
        "apply_url": "",
        "apply_note": "Comunicazione diretta al datore di lavoro (per le autonome, all'INPS).",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite dichiarazione dei redditi (730/Redditi PF) con CAF o commercialista.",
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
        "apply_url": "",
        "apply_note": "Nessuna domanda: presenta la DSU per l'ISEE tramite CAF o INPS; lo sconto arriva in automatico in bolletta.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite modulo dedicato presso gli uffici di Poste Italiane.",
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
        "apply_url": "https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.bonus-nuovi-nati.html",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite lo sportello del Comune di residenza (o CAF/patronato).",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite dichiarazione dei redditi con CAF o commercialista.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite dichiarazione dei redditi con CAF o commercialista (pagamento con bonifico dedicato).",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite i servizi sociali del Comune e il centro antiviolenza di riferimento.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite il portale regionale per il diritto allo studio (es. DiSCo Lazio, DSU Toscana) o CAF.",
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
        "id": "bonus-affitto-lombardia",
        "name": "Bonus Affitto Lombardia",
        "category": "Casa",
        "icon": "home",
        "short": "Contributo di Regione Lombardia per l'affitto.",
        "description": "Misura regionale (fondi statali + regionali gestiti dai Comuni/ALER) a sostegno degli inquilini lombardi in difficoltà economica per il pagamento del canone di locazione della prima casa.",
        "amount": "fino a circa 2.400 € (max 4 mensilità)",
        "deadline": "2026-10-31",
        "deadline_note": "Bando annuale di Regione Lombardia/Comuni, di norma in autunno; verifica le aperture sul portale.",
        "how": "Domanda sul portale Bandi Online di Regione Lombardia (o presso il Comune) con SPID/CIE, allegando ISEE e contratto registrato.",
        "source": "Regione Lombardia",
        "rule": lambda p: p.region == "Lombardia" and p.renting and p.isee_range in ("0-10", "10-25"),
        "why": "Risiedi in Lombardia, sei in affitto e con ISEE entro la soglia del bando.",
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
        "apply_url": "",
        "apply_note": "Richiesta tramite il Comune di residenza o il portale della tua Regione durante il bando.",
        "region_scope": "Nazionale (bando per singola regione)",
    },
]

REQUIREMENTS = {
    "assegno-unico": "Serve avere almeno un figlio a carico.",
    "bonus-asilo-nido": "Serve avere figli sotto i 3 anni.",
    "carta-dedicata-a-te": "Serve ISEE fino a ~15.000 € e nucleo di almeno 3 persone.",
    "assegno-inclusione": "Serve ISEE molto basso (~10.140 €) con minori, disabilità o over 60.",
    "naspi": "Serve essere disoccupato dopo un lavoro dipendente con contributi.",
    "bonus-affitto-giovani": "Serve avere meno di 31 anni, essere in affitto e reddito basso.",
    "bonus-ristrutturazioni": "Serve essere proprietari di un immobile e presentare la dichiarazione.",
    "bonus-elettrodomestici": "Disponibile per tutti i residenti.",
    "bonus-psicologo": "Serve un ISEE in corso di validità non superiore a 50.000 €.",
    "carta-cultura-giovani": "Serve avere 18 anni con ISEE entro 35.000 €.",
    "bonus-mamme": "Serve essere lavoratrice/lavoratore con almeno 2 figli.",
    "detrazione-spese-mediche": "Serve presentare la dichiarazione dei redditi.",
    "bonus-sociale-bollette": "Serve un ISEE basso (o nucleo numeroso con 3+ figli).",
    "carta-acquisti": "Serve avere over 65 o figli sotto i 3 anni con ISEE molto basso.",
    "bonus-nuovi-nati": "Serve una nascita/adozione recente con ISEE entro 40.000 €.",
    "assegno-maternita-comuni": "Serve essere madre senza altra indennità, con figlio piccolo e ISEE basso.",
    "detrazione-istruzione": "Servono spese di istruzione e la presentazione della dichiarazione.",
    "bonus-barriere": "Serve essere proprietario o avere disabilità nel nucleo, e dichiarare.",
    "reddito-liberta": "Riservato alle donne vittime di violenza seguite dai centri antiviolenza.",
    "borsa-studio-regionale": "Serve essere studente con ISEE entro le soglie regionali.",
    "dote-scuola-lombardia": "Serve risiedere in Lombardia, avere figli a scuola e ISEE basso.",
    "bonus-affitto-lombardia": "Serve risiedere in Lombardia, essere in affitto e avere ISEE entro la soglia del bando.",
    "contributo-affitto-regionale": "Serve essere in affitto con ISEE contenuto.",
}

GUIDES = {
    "bonus-affitto-giovani": {
        "title": "Detrazione Affitto nel 730",
        "intro": "La detrazione per l'affitto dell'abitazione principale si ottiene inserendo i dati del contratto nella dichiarazione dei redditi (730 o Redditi PF). Non è una domanda a sportello: è uno sconto d'imposta.",
        "documents": [
            "Contratto di locazione registrato all'Agenzia delle Entrate",
            "Estremi di registrazione del contratto (data e numero)",
            "Codice fiscale del proprietario (locatore)",
            "Ricevute o bonifici dei canoni pagati nell'anno",
            "Certificazione Unica (CU) e/o altri redditi",
            "Attestazione di residenza nell'immobile (autocertificabile)",
        ],
        "steps": [
            "Accedi al 730 precompilato sul sito dell'Agenzia delle Entrate con SPID/CIE, oppure rivolgiti a un CAF/commercialista.",
            "Vai nel Quadro E - Oneri e spese, sezione 'Detrazioni per canoni di locazione'.",
            "Scegli il rigo corretto in base al tuo caso: E71 (inquilini abitazione principale) o E72 (giovani under 31).",
            "Indica il codice del tipo di detrazione e il numero di giorni e la percentuale di spettanza.",
            "Verifica che l'immobile sia la tua abitazione principale (residenza).",
            "Controlla il calcolo della detrazione e invia la dichiarazione entro la scadenza.",
        ],
        "steps_help": [
            {"images": [
                {"caption": "Home del sito Agenzia delle Entrate: pulsante 'Accedi all'area riservata' in alto a destra.", "url": ""},
                {"caption": "Schermata di scelta del metodo di accesso: SPID, CIE o CNS.", "url": ""},
            ]},
            {"images": [
                {"caption": "Menu del 730 precompilato con l'elenco dei quadri: evidenziato il 'Quadro E - Oneri e spese'.", "url": ""},
                {"caption": "Sezione 'Detrazioni per canoni di locazione' all'interno del Quadro E.", "url": ""},
            ]},
            {"images": [
                {"caption": "Elenco righi E71 ed E72 con descrizione: differenza tra inquilini abitazione principale e giovani under 31.", "url": ""},
            ]},
            {"images": [
                {"caption": "Campo 'Codice' del rigo con il menu a tendina dei tipi di detrazione.", "url": ""},
                {"caption": "Campi 'Numero giorni' e 'Percentuale di spettanza' da compilare.", "url": ""},
            ]},
            {"images": [
                {"caption": "Riepilogo dati anagrafici con l'indirizzo di residenza che coincide con l'immobile in affitto.", "url": ""},
            ]},
            {"images": [
                {"caption": "Schermata del ricalcolo dell'imposta con l'importo della detrazione applicata.", "url": ""},
                {"caption": "Pulsante 'Invia la dichiarazione' e schermata della ricevuta di trasmissione.", "url": ""},
            ]},
        ],
        "critical_fields": [
            {"field": "Rigo E71 vs E72", "note": "E72 è riservato ai giovani 20-31 anni con reddito basso ed è più vantaggioso; non cumulabile con E71 per lo stesso periodo."},
            {"field": "Giorni e percentuale", "note": "Indica i giorni in cui l'immobile è stata abitazione principale e la % se il contratto è cointestato (es. 50%)."},
            {"field": "Abitazione principale", "note": "La detrazione spetta solo per la casa dove hai la residenza, non per seconde case o affitti brevi."},
            {"field": "Reddito complessivo", "note": "L'importo detraibile diminuisce oltre 15.493,71 € e si azzera oltre 30.987,41 €."},
        ],
        "apply_url": "https://www.agenziaentrate.gov.it",
        "deadlines_requirements": [
            "730 precompilato: invio di norma entro il 30 settembre.",
            "Il contratto deve essere regolarmente registrato.",
            "Serve avere la residenza nell'immobile affittato.",
        ],
        "extra_info": [
            {"title": "Tipi di contratto e cosa cambia", "text": "Canone LIBERO (4+4 anni): detrazione base per inquilini. Canone CONCORDATO (3+2, art. 2 c.3): detrazione più alta perché il canone è calmierato. Contratto TRANSITORIO o per STUDENTI fuori sede: esistono detrazioni dedicate (rigo E72/E71 con codici specifici). Verifica sempre quale codice usare in base al tuo contratto."},
            {"title": "Se il contratto è cointestato", "text": "Ogni intestatario detrae la propria quota. Se pagate in due al 50%, ciascuno indica il 50% nel proprio 730."},
            {"title": "Cumulabilità", "text": "Non puoi sommare due detrazioni affitto diverse per lo stesso periodo: scegli quella più conveniente (di solito quella per giovani se hai i requisiti)."},
        ],
    },
    "assegno-unico": {
        "title": "Assegno Unico per Figli a Carico",
        "intro": "L'Assegno Unico e Universale è un contributo mensile INPS per ogni figlio a carico. Si richiede una sola volta con domanda telematica; poi si rinnova/aggiorna l'ISEE.",
        "documents": [
            "SPID livello 2, CIE 3.0 o CNS del richiedente",
            "ISEE in corso di validità (DSU aggiornata)",
            "Codici fiscali di entrambi i genitori e dei figli",
            "IBAN del richiedente (conto intestato/cointestato)",
            "Eventuale documentazione di disabilità del figlio",
        ],
        "steps": [
            "Aggiorna o presenta la DSU per avere un ISEE valido (tramite INPS o CAF).",
            "Accedi al portale INPS al servizio 'Assegno unico e universale per i figli a carico' con SPID/CIE.",
            "Seleziona 'Nuova domanda' e verifica i dati anagrafici del nucleo.",
            "Inserisci i figli a carico e i relativi codici fiscali.",
            "Indica l'IBAN su cui ricevere l'accredito (o scegli il bonifico domiciliato).",
            "Conferma e invia la domanda; annota il numero di protocollo.",
        ],
        "steps_help": [
            {"images": [
                {"caption": "Portale INPS: servizio 'ISEE / DSU precompilata' per presentare o aggiornare la DSU.", "url": ""},
                {"caption": "Attestazione ISEE in corso di validità con il valore del nucleo familiare.", "url": ""},
            ]},
            {"images": [
                {"caption": "Ricerca nel portale INPS del servizio 'Assegno unico e universale per i figli a carico'.", "url": ""},
                {"caption": "Schermata di login INPS con SPID, CIE o CNS.", "url": ""},
            ]},
            {"images": [
                {"caption": "Pulsante 'Nuova domanda' nella schermata del servizio Assegno Unico.", "url": ""},
                {"caption": "Riepilogo dei dati anagrafici del nucleo familiare da confermare.", "url": ""},
            ]},
            {"images": [
                {"caption": "Sezione 'Figli a carico' con il pulsante per aggiungere un figlio e inserire il codice fiscale.", "url": ""},
            ]},
            {"images": [
                {"caption": "Campo IBAN per l'accredito e opzione alternativa 'bonifico domiciliato'.", "url": ""},
            ]},
            {"images": [
                {"caption": "Schermata di riepilogo finale con il pulsante 'Invia domanda'.", "url": ""},
                {"caption": "Ricevuta con il numero di protocollo della domanda inviata.", "url": ""},
            ]},
        ],
        "critical_fields": [
            {"field": "IBAN del beneficiario", "note": "Deve essere intestato o cointestato a chi presenta la domanda, altrimenti il pagamento viene sospeso."},
            {"field": "ISEE valido", "note": "Senza ISEE aggiornato ricevi solo l'importo minimo; aggiornalo entro il 28 febbraio per gli arretrati da marzo."},
            {"field": "Ripartizione tra genitori", "note": "Puoi scegliere il 100% a un genitore o il 50% ciascuno: incide su chi riceve l'accredito."},
            {"field": "Maggiorazioni", "note": "Indica correttamente disabilità, figli under 1, madri under 21 o nuclei numerosi per ottenere le maggiorazioni."},
        ],
        "apply_url": "https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.assegno-unico-e-universale-per-i-figli-a-carico-55984.assegno-unico-e-universale-per-i-figli-a-carico.html",
        "deadlines_requirements": [
            "Domanda presentabile tutto l'anno; le domande accolte si rinnovano automaticamente.",
            "Per gli arretrati da marzo, aggiorna l'ISEE entro il 28 febbraio.",
            "Spetta per figli fino a 21 anni (senza limiti se con disabilità).",
        ],
        "extra_info": [
            {"title": "Serve rifare la domanda ogni anno?", "text": "No: dal 2023 le domande accolte proseguono in automatico. Devi però aggiornare l'ISEE ogni anno per non ricevere solo l'importo minimo."},
            {"title": "Figli maggiorenni", "text": "Tra 18 e 21 anni l'assegno spetta se il figlio studia, fa un tirocinio, lavora con basso reddito o è in cerca di lavoro: va indicata la condizione."},
            {"title": "Separati o divorziati", "text": "In caso di affido condiviso l'assegno è ripartito al 50% salvo diverso accordo; entrambi i genitori possono vedere/gestire la domanda."},
        ],
    },
    "bonus-affitto-lombardia": {
        "title": "Bonus Affitto Lombardia",
        "intro": "Contributo di Regione Lombardia (fondi gestiti da Comuni/ALER) per aiutare gli inquilini in difficoltà a pagare l'affitto della prima casa. Si richiede tramite bando su Bandi Online.",
        "documents": [
            "SPID/CIE del richiedente",
            "ISEE ordinario in corso di validità",
            "Contratto di locazione registrato (uso abitativo, prima casa)",
            "Ricevute/bonifici dei canoni e delle eventuali morosità",
            "Documento di identità e permesso di soggiorno (se extra UE)",
            "Attestazione di residenza in Lombardia da almeno il periodo richiesto dal bando",
        ],
        "steps": [
            "Verifica l'apertura del bando sul portale Bandi Online di Regione Lombardia (o chiedi al tuo Comune/ALER).",
            "Registrati/accedi a Bandi Online con SPID o CIE.",
            "Cerca la misura 'Contributo per l'affitto' / 'sostegno alla locazione' aperta per la tua annualità.",
            "Compila l'anagrafica e allega ISEE, contratto registrato e ricevute dei pagamenti.",
            "Indica l'IBAN per l'accredito e la situazione di morosità (se presente).",
            "Invia la domanda entro la scadenza del bando e conserva la ricevuta di protocollo.",
        ],
        "steps_help": [
            {"images": [
                {"caption": "Home di Bandi Online Regione Lombardia con la barra di ricerca dei bandi.", "url": ""},
                {"caption": "Scheda del bando 'Contributo per l'affitto' con lo stato 'Aperto'.", "url": ""},
            ]},
            {"images": [
                {"caption": "Pulsante 'Accedi' di Bandi Online con la scelta del metodo SPID/CIE.", "url": ""},
            ]},
            {"images": [
                {"caption": "Elenco delle misure aperte con evidenziato 'sostegno alla locazione / contributo affitto'.", "url": ""},
            ]},
            {"images": [
                {"caption": "Modulo anagrafico del richiedente da compilare.", "url": ""},
                {"caption": "Sezione allegati: caricamento di ISEE, contratto registrato e ricevute di pagamento.", "url": ""},
            ]},
            {"images": [
                {"caption": "Campo IBAN per l'accredito del contributo.", "url": ""},
                {"caption": "Sezione per dichiarare l'eventuale morosità e i mesi di canone non pagati.", "url": ""},
            ]},
            {"images": [
                {"caption": "Pulsante 'Invia domanda' con l'indicazione della scadenza del bando.", "url": ""},
                {"caption": "Ricevuta di protocollo scaricabile in PDF.", "url": ""},
            ]},
        ],
        "critical_fields": [
            {"field": "Residenza in Lombardia", "note": "L'immobile deve essere la tua abitazione principale in Lombardia; molti bandi richiedono residenza da un certo periodo."},
            {"field": "Soglia ISEE del bando", "note": "Ogni edizione fissa un tetto ISEE (spesso ~ 26.000 € o inferiore): controlla il valore esatto del bando in corso."},
            {"field": "Contratto registrato", "note": "Il contratto deve essere regolarmente registrato; gli affitti in nero non danno diritto al contributo."},
            {"field": "Non cumulabilità", "note": "Spesso non è cumulabile con Assegno di Inclusione o altri contributi affitto per lo stesso periodo: leggi il bando."},
        ],
        "apply_url": "https://www.bandi.regione.lombardia.it",
        "deadlines_requirements": [
            "Bando periodico: valido solo nelle finestre di apertura (spesso in autunno).",
            "Fondi limitati: conta l'ordine di arrivo o la graduatoria per ISEE.",
            "Serve contratto registrato e residenza nell'immobile in Lombardia.",
        ],
        "extra_info": [
            {"title": "Bando regionale vs comunale", "text": "Regione Lombardia stanzia i fondi ma spesso sono i Comuni o ALER a pubblicare il bando operativo. Controlla entrambi i canali per non perdere la finestra."},
            {"title": "Tipi di contratto ammessi", "text": "Di norma sono ammessi contratti a canone libero (4+4) e concordato (3+2) a uso abitativo. Sono esclusi comodati, alloggi ERP/case popolari a canone sociale e contratti non registrati."},
            {"title": "Morosità incolpevole", "text": "Alcune edizioni prevedono una linea specifica per chi non riesce a pagare per perdita del lavoro o riduzione del reddito: richiede documentazione aggiuntiva sulla causa della morosità."},
        ],
    },
}

def public_bonus(b: dict, profile: Optional[Profile] = None) -> dict:
    out = {k: v for k, v in b.items() if k != "rule"}
    out["requirement"] = REQUIREMENTS.get(b["id"], "Requisiti specifici non soddisfatti dal tuo profilo.")
    out["has_guide"] = True
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

def build_guide(b: dict) -> dict:
    text = f"{b.get('declaration','')} {b.get('how','')} {b.get('apply_note','')}".lower()
    req = REQUIREMENTS.get(b["id"], "")
    if "poste" in text or "comune" in text or "sportello" in text or "servizi sociali" in text:
        channel = "sportello"
    elif "inps" in text or "patronato" in text:
        channel = "inps"
    elif "dichiarazione dei redditi" in text or "quadro e" in text:
        channel = "tax"
    elif "portale" in text or "bandi" in text or "piattaforma" in text or "registrazione" in text or b.get("apply_url"):
        channel = "portale"
    else:
        channel = "generic"

    docs = {
        "tax": ["SPID/CIE o credenziali per l'area riservata dell'Agenzia delle Entrate", "Fatture, ricevute, scontrini parlanti e bonifici delle spese sostenute nell'anno", "Certificazione Unica (CU) e documentazione degli altri redditi", "Codice fiscale tuo e dei familiari a carico collegati alla spesa", "Eventuale documentazione che attesti il diritto (es. contratto, prescrizione medica)"],
        "inps": ["SPID livello 2, CIE 3.0 o CNS del richiedente", "ISEE in corso di validità (presenta o aggiorna la DSU)", "Codici fiscali di tutti i componenti del nucleo familiare", "IBAN di un conto intestato o cointestato al richiedente", "Eventuale documentazione specifica (certificazione di disabilità, stato di disoccupazione, ecc.)"],
        "sportello": ["Documento d'identità valido e codice fiscale/tessera sanitaria", "ISEE in corso di validità", "Modulo di domanda fornito dall'ente (Comune/Poste/servizi sociali)", "Documentazione a supporto richiesta dal bando (contratto, ricevute, relazione dei servizi sociali)", "IBAN per l'eventuale accredito del contributo"],
        "portale": ["SPID o CIE per l'accesso al portale dedicato", "ISEE in corso di validità (se richiesto dal bando)", "Documentazione a supporto (contratto registrato, ricevute, fatture d'acquisto)", "IBAN per l'accredito del contributo/voucher", "Documento d'identità (per stranieri anche permesso di soggiorno)"],
        "generic": ["Documento d'identità e codice fiscale", "ISEE in corso di validità (se previsto)", "Documentazione a supporto della richiesta", "IBAN per l'eventuale accredito"],
    }[channel]

    steps = {
        "tax": ["Raccogli tutti i documenti di spesa dell'anno d'imposta di riferimento e verifica che siano tracciabili (pagamenti con mezzi tracciabili dove richiesto).", "Accedi al 730 precompilato con SPID/CIE, oppure affidati a un CAF o commercialista.", "Controlla i dati precompilati e apri il Quadro E - Oneri e spese.", "Individua il rigo corretto per questa agevolazione e inserisci gli importi.", "Indica la quota di spettanza se la spesa è cointestata (es. 50%).", "Verifica il ricalcolo dell'imposta e il rimborso/risparmio stimato.", "Invia la dichiarazione entro la scadenza e conserva la ricevuta di trasmissione."],
        "inps": ["Verifica di avere un ISEE valido: se scaduto, presenta una nuova DSU (INPS o CAF).", "Accedi al portale INPS con SPID/CIE e cerca il servizio dedicato a questo bonus.", "Seleziona 'Nuova domanda' e controlla i dati anagrafici del nucleo.", "Compila tutti i campi richiesti e indica le eventuali condizioni particolari (disabilità, figli, ecc.).", "Inserisci l'IBAN per l'accredito o scegli un'altra modalità di pagamento.", "Controlla il riepilogo, invia la domanda e salva il numero di protocollo.", "Monitora lo stato della domanda nella sezione 'Le mie domande'."],
        "sportello": ["Verifica requisiti, importi e finestra di apertura presso il Comune o lo sportello competente.", "Richiedi o scarica il modulo di domanda ufficiale.", "Prepara ISEE, documento d'identità e la documentazione richiesta dal bando.", "Compila il modulo, se necessario con l'aiuto di un CAF o patronato (gratuito).", "Consegna la domanda allo sportello o inviala secondo le modalità indicate.", "Fatti rilasciare e conserva la ricevuta/protocollo della domanda.", "Verifica l'esito o la posizione in graduatoria nei tempi comunicati dall'ente."],
        "portale": ["Verifica l'apertura del bando/servizio e leggi con attenzione il regolamento.", "Registrati o accedi al portale con SPID/CIE.", "Compila l'anagrafica e verifica i dati importati automaticamente.", "Allega i documenti richiesti (contratto, ricevute, ISEE) nei formati previsti.", "Indica l'IBAN e conferma tutti i dati inseriti.", "Invia la domanda entro la scadenza e scarica la ricevuta di protocollo.", "Controlla periodicamente lo stato della pratica e le eventuali integrazioni richieste."],
        "generic": ["Verifica di possedere tutti i requisiti richiesti.", "Raccogli la documentazione necessaria.", "Presenta la richiesta secondo il canale indicato.", "Conserva la ricevuta o il protocollo della domanda.", "Verifica l'esito nei tempi previsti."],
    }[channel]

    critical = [
        {"field": "Requisito principale", "note": req or "Controlla di rientrare nei requisiti indicati per questo aiuto."},
        {"field": "ISEE aggiornato", "note": "Molti aiuti richiedono un ISEE valido e aggiornato all'anno in corso: rifai la DSU a inizio anno per non perdere importi o arretrati."},
        {"field": "Importo spettante", "note": f"Per questo aiuto è previsto: {b.get('amount','importo variabile')}. L'importo effettivo può dipendere da ISEE, reddito e composizione del nucleo."},
    ]
    if channel in ("inps", "portale"):
        critical.append({"field": "IBAN del beneficiario", "note": "Deve essere intestato o cointestato a chi presenta la domanda: un IBAN di terzi blocca l'accredito."})
    if channel == "tax":
        critical.append({"field": "Quota di spettanza", "note": "Se la spesa è cointestata, indica solo la tua quota (es. 50%). Usa il rigo esatto per non perdere la detrazione."})
        critical.append({"field": "Pagamenti tracciabili", "note": "Molte detrazioni al 19% richiedono pagamento tracciabile (bancomat, bonifico, carta): i contanti non danno diritto allo sconto."})
    if channel == "sportello":
        critical.append({"field": "Rispetto della graduatoria", "note": "I fondi sono spesso limitati: presenta la domanda appena il bando apre e completa tutti gli allegati per non essere escluso."})
    critical.append({"field": "Scadenza", "note": b.get("deadline_note", "Rispetta la finestra temporale indicata.")})

    channel_tip = {
        "tax": {"title": "730 precompilato o ordinario?", "text": "Il 730 precompilato è più veloce perché molte spese sono già inserite dal Sistema Tessera Sanitaria; controlla comunque che ci siano tutte. Se accetti il precompilato senza modifiche, eviti i controlli documentali. In caso di dubbi, un CAF o commercialista può presentarlo per te."},
        "inps": {"title": "Serve rifare la domanda ogni anno?", "text": "Dipende dalla misura: alcune si rinnovano in automatico, altre richiedono una nuova domanda a ogni annualità o al rinnovo dell'ISEE. Controlla nella sezione 'Le mie domande' dell'INPS lo stato e le scadenze di rinnovo."},
        "sportello": {"title": "Assistenza gratuita", "text": "CAF e patronati offrono assistenza gratuita per compilare e inviare la domanda e per calcolare l'ISEE. Porta con te tutti i documenti in originale e copia per velocizzare la pratica."},
        "portale": {"title": "Fondi a esaurimento", "text": "Molti bonus su piattaforma funzionano fino a esaurimento fondi o in ordine cronologico: prepara i documenti in anticipo e invia la domanda appena il servizio apre."},
        "generic": {"title": "Come farti aiutare", "text": "In caso di dubbi puoi rivolgerti a un CAF o patronato per assistenza gratuita nella presentazione della domanda."},
    }[channel]

    return {
        "title": b["name"],
        "intro": f"{b['description']} {b.get('declaration','')} Importo previsto: {b.get('amount','variabile')}.",
        "documents": docs,
        "steps": steps,
        "critical_fields": critical,
        "apply_url": b.get("apply_url", ""),
        "deadlines_requirements": [f"Scadenza: {b.get('deadline_note','')}", f"Requisito: {req}" if req else "Verifica i requisiti sul sito dell'ente erogatore.", "Conserva sempre la ricevuta di protocollo della domanda."],
        "extra_info": [
            channel_tip,
            {"title": "Dove e come presentare", "text": b.get("apply_note") or b.get("how", "")},
            {"title": "Ente erogatore e assistenza", "text": f"La misura è gestita da: {b.get('source','')}. Per assistenza gratuita puoi rivolgerti a un CAF o patronato, che possono anche calcolare l'ISEE e inviare la domanda per te."},
        ],
    }


@api_router.get("/bonus/{bonus_id}/guide")
async def get_guide(bonus_id: str):
    if bonus_id in GUIDES:
        return GUIDES[bonus_id]
    for b in BONUSES:
        if b["id"] == bonus_id:
            return build_guide(b)
    raise HTTPException(status_code=404, detail="Guida non disponibile per questo bonus")

@api_router.get("/bonus/{bonus_id}")
async def get_bonus(bonus_id: str):
    for b in BONUSES:
        if b["id"] == bonus_id:
            return public_bonus(b)
    raise HTTPException(status_code=404, detail="Bonus non trovato")

@api_router.post("/bonus/{bonus_id}/detail")
async def get_bonus_detail(bonus_id: str, profile: Profile):
    for b in BONUSES:
        if b["id"] == bonus_id:
            return public_bonus(b, profile)
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
