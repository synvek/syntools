#!/usr/bin/env python3
"""
Translate en locale → it / es / pt TypeScript locale files via MyMemory API.
Preserves {{placeholders}}, <n> tags, and SynTools.
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "scripts" / ".en-locale.json"
CACHE_DIR = ROOT / "scripts" / ".i18n-cache"
OUT_DIR = ROOT / "src" / "core" / "i18n" / "locales"
CHUNK_DIR = ROOT / "scripts" / "locale-chunks"

LANGS = {
    "it": {"pair": "en|it", "comment": "Italian translation resources", "const": "it"},
    "es": {"pair": "en|es", "comment": "Spanish translation resources", "const": "es"},
    "pt": {"pair": "en|pt", "comment": "Portuguese translation resources", "const": "pt"},
}

# High-frequency UI glossary (overrides MT for consistency)
GLOSSARY: dict[str, dict[str, str]] = {
    "it": {
        "Copy": "Copia",
        "Copied": "Copiato",
        "Clear": "Cancella",
        "Swap": "Scambia",
        "Download": "Scarica",
        "Share": "Condividi",
        "Retry": "Riprova",
        "Loading": "Caricamento",
        "Action": "Azione",
        "Encode": "Codifica",
        "Decode": "Decodifica",
        "Result": "Risultato",
        "Raw text": "Testo grezzo",
        "Input": "Input",
        "Output": "Output",
        "Text": "Testo",
        "File": "File",
        "Remove": "Rimuovi",
        "Open menu": "Apri menu",
        "Close menu": "Chiudi menu",
        "Search tools": "Cerca strumenti",
        "Search tools…": "Cerca strumenti…",
        "Toggle theme": "Cambia tema",
        "Switch language": "Cambia lingua",
        "Source code": "Codice sorgente",
        "Favorites": "Preferiti",
        "Recently used": "Usati di recente",
        "Add to favorites": "Aggiungi ai preferiti",
        "Remove from favorites": "Rimuovi dai preferiti",
        "Filter tools": "Filtra strumenti",
        "Filter…": "Filtra…",
        "No matching tools": "Nessuno strumento corrispondente",
        "No matching tools found": "Nessuno strumento corrispondente trovato",
        "Encoding": "Codifica",
        "Formatting": "Formattazione",
        "Crypto & Hash": "Crittografia e hash",
        "Date & Time": "Data e ora",
        "Generators": "Generatori",
        "Network": "Rete",
        "Images": "Immagini",
        "Other": "Altro",
        "Developer Online Toolbox": "Toolbox online per sviluppatori",
        "{{size}} bytes": "{{size}} byte",
        "{{chars}} chars / {{bytes}} bytes": "{{chars}} caratteri / {{bytes}} byte",
    },
    "es": {
        "Copy": "Copiar",
        "Copied": "Copiado",
        "Clear": "Borrar",
        "Swap": "Intercambiar",
        "Download": "Descargar",
        "Share": "Compartir",
        "Retry": "Reintentar",
        "Loading": "Cargando",
        "Action": "Acción",
        "Encode": "Codificar",
        "Decode": "Decodificar",
        "Result": "Resultado",
        "Raw text": "Texto sin procesar",
        "Input": "Entrada",
        "Output": "Salida",
        "Text": "Texto",
        "File": "Archivo",
        "Remove": "Eliminar",
        "Open menu": "Abrir menú",
        "Close menu": "Cerrar menú",
        "Search tools": "Buscar herramientas",
        "Search tools…": "Buscar herramientas…",
        "Toggle theme": "Cambiar tema",
        "Switch language": "Cambiar idioma",
        "Source code": "Código fuente",
        "Favorites": "Favoritos",
        "Recently used": "Usados recientemente",
        "Add to favorites": "Añadir a favoritos",
        "Remove from favorites": "Quitar de favoritos",
        "Filter tools": "Filtrar herramientas",
        "Filter…": "Filtrar…",
        "No matching tools": "No hay herramientas coincidentes",
        "No matching tools found": "No se encontraron herramientas coincidentes",
        "Encoding": "Codificación",
        "Formatting": "Formato",
        "Crypto & Hash": "Cifrado y hash",
        "Date & Time": "Fecha y hora",
        "Generators": "Generadores",
        "Network": "Red",
        "Images": "Imágenes",
        "Other": "Otros",
        "Developer Online Toolbox": "Caja de herramientas online para desarrolladores",
        "{{size}} bytes": "{{size}} bytes",
        "{{chars}} chars / {{bytes}} bytes": "{{chars}} caracteres / {{bytes}} bytes",
    },
    "pt": {
        "Copy": "Copiar",
        "Copied": "Copiado",
        "Clear": "Limpar",
        "Swap": "Trocar",
        "Download": "Transferir",
        "Share": "Partilhar",
        "Retry": "Tentar novamente",
        "Loading": "A carregar",
        "Action": "Ação",
        "Encode": "Codificar",
        "Decode": "Descodificar",
        "Result": "Resultado",
        "Raw text": "Texto em bruto",
        "Input": "Entrada",
        "Output": "Saída",
        "Text": "Texto",
        "File": "Ficheiro",
        "Remove": "Remover",
        "Open menu": "Abrir menu",
        "Close menu": "Fechar menu",
        "Search tools": "Pesquisar ferramentas",
        "Search tools…": "Pesquisar ferramentas…",
        "Toggle theme": "Alternar tema",
        "Switch language": "Mudar idioma",
        "Source code": "Código-fonte",
        "Favorites": "Favoritos",
        "Recently used": "Usados recentemente",
        "Add to favorites": "Adicionar aos favoritos",
        "Remove from favorites": "Remover dos favoritos",
        "Filter tools": "Filtrar ferramentas",
        "Filter…": "Filtrar…",
        "No matching tools": "Nenhuma ferramenta correspondente",
        "No matching tools found": "Nenhuma ferramenta correspondente encontrada",
        "Encoding": "Codificação",
        "Formatting": "Formatação",
        "Crypto & Hash": "Criptografia e hash",
        "Date & Time": "Data e hora",
        "Generators": "Geradores",
        "Network": "Rede",
        "Images": "Imagens",
        "Other": "Outros",
        "Developer Online Toolbox": "Caixa de ferramentas online para programadores",
        "{{size}} bytes": "{{size}} bytes",
        "{{chars}} chars / {{bytes}} bytes": "{{chars}} caracteres / {{bytes}} bytes",
    },
}

# Protect tokens that must survive MT unchanged
PROTECT_RE = re.compile(
    r"(SynTools|\{\{[^{}]+\}\}|</?\d+>|⌘K|"
    r"\b(?:Base64|JWT|JSON|PDF|SHA-256|SHA-1|SHA-512|HMAC|TOTP|UUID|CIDR|EXIF|"
    r"AES-GCM|AES|GCM|MD5|CRC32|UTF-8|UTF8|URL|URI|HTML|CSS|XML|CSV|YAML|"
    r"QR|OTP|IANA|ISO|UTC|Unix|Cron|Regex|RegExp|HTTPS?|DNS|IP|IPv4|IPv6|"
    r"MIME|PNG|JPEG|JPG|GIF|SVG|WebP|BMP|TIFF|WASM|CSP)\b)"
)

SKIP_TRANSLATE = re.compile(
    r"^[\d\s\.\,\:\;\-\+\=\/\|\(\)\[\]\{\}\<\>\%\#\@\!\?\'\"\`~^&*_]+$"
)


def collect_strings(obj, out: set[str]) -> None:
    if isinstance(obj, str):
        out.add(obj)
    elif isinstance(obj, list):
        for x in obj:
            collect_strings(x, out)
    elif isinstance(obj, dict):
        for v in obj.values():
            collect_strings(v, out)


def protect(text: str) -> tuple[str, list[str]]:
    tokens: list[str] = []

    def repl(m: re.Match[str]) -> str:
        tokens.append(m.group(0))
        return f"⟦{len(tokens) - 1}⟧"

    return PROTECT_RE.sub(repl, text), tokens


def unprotect(text: str, tokens: list[str]) -> str:
    def repl(m: re.Match[str]) -> str:
        i = int(m.group(1))
        return tokens[i] if 0 <= i < len(tokens) else m.group(0)

    text = re.sub(r"⟦\s*(\d+)\s*⟧", repl, text)
    # Restore spaces around restored placeholders if MT ate them
    text = re.sub(r"(\S)(\{\{)", r"\1 \2", text)
    text = re.sub(r"(\}\})(\S)", r"\1 \2", text)
    text = re.sub(r"  +", " ", text)
    return text


def placeholders(s: str) -> list[str]:
    return re.findall(r"\{\{[^{}]+\}\}|</?\d+>", s)


def validate_mapping(mapping: dict[str, str]) -> int:
    bad = 0
    for src, dst in mapping.items():
        if placeholders(src) != placeholders(dst):
            # try soft fix: if counts match but order differs, leave; else keep EN
            if sorted(placeholders(src)) != sorted(placeholders(dst)):
                bad += 1
    return bad

def translate_one(text: str, pair: str, retries: int = 4) -> str:
    if not text or SKIP_TRANSLATE.match(text):
        return text
    protected, tokens = protect(text)
    q = urllib.parse.quote(protected)
    url = (
        f"https://api.mymemory.translated.net/get?q={q}&langpair={pair}"
        f"&de=syntools-i18n@users.noreply.github.com"
    )
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            status = data.get("responseStatus")
            if status != 200 and status != "200":
                raise RuntimeError(f"status={status} details={data.get('responseDetails')}")
            out = data["responseData"]["translatedText"]
            # MyMemory sometimes returns the same WARNING messages
            if out.startswith("MYMEMORY WARNING"):
                raise RuntimeError(out)
            return unprotect(out, tokens)
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(0.8 * (attempt + 1))
    print(f"FAIL [{pair}] {text[:60]!r}: {last_err}")
    return text  # fallback: keep English


def load_cache(lang: str) -> dict[str, str]:
    path = CACHE_DIR / f"{lang}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_cache(lang: str, cache: dict[str, str]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{lang}.json"
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")


def apply_map(obj, mapping: dict[str, str]):
    if isinstance(obj, str):
        return mapping.get(obj, obj)
    if isinstance(obj, list):
        return [apply_map(x, mapping) for x in obj]
    if isinstance(obj, dict):
        return {k: apply_map(v, mapping) for k, v in obj.items()}
    return obj


def to_ts(lang: str, data: dict) -> str:
    meta = LANGS[lang]
    body = json.dumps(data, ensure_ascii=False, indent=2)
    return (
        f"import type {{ TranslationResources }} from '../types';\n\n"
        f"/** {meta['comment']} */\n"
        f"const {meta['const']} = {body} satisfies TranslationResources;\n\n"
        f"export default {meta['const']};\n"
    )


def translate_lang(lang: str, strings: list[str], workers: int = 6) -> dict[str, str]:
    meta = LANGS[lang]
    cache = load_cache(lang)
    # Seed glossary first (always override for consistency)
    for en, tr in GLOSSARY.get(lang, {}).items():
        cache[en] = tr
    pending = [s for s in strings if s not in cache]
    print(f"[{lang}] cached={len(cache)} pending={len(pending)}")
    if not pending:
        save_cache(lang, cache)
        return cache

    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(translate_one, s, meta["pair"]): s for s in pending}
        for fut in as_completed(futs):
            src = futs[fut]
            cache[src] = fut.result()
            done += 1
            if done % 50 == 0 or done == len(pending):
                save_cache(lang, cache)
                print(f"[{lang}] {done}/{len(pending)}", flush=True)
    # Re-apply glossary after MT
    for en, tr in GLOSSARY.get(lang, {}).items():
        cache[en] = tr
    save_cache(lang, cache)
    return cache


def write_chunks(lang: str, full: dict) -> None:
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    for key, value in full.items():
        path = CHUNK_DIR / f"{lang}-{key}.json"
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    unique: set[str] = set()
    collect_strings(en, unique)
    strings = sorted(unique, key=lambda s: (len(s), s))
    print(f"unique strings: {len(strings)}")

    for lang in LANGS:
        mapping = translate_lang(lang, strings)
        # Fix broken placeholder translations by falling back to English
        fixed = 0
        for src in list(mapping.keys()):
            dst = mapping[src]
            if sorted(placeholders(src)) != sorted(placeholders(dst)):
                mapping[src] = src
                fixed += 1
        if fixed:
            print(f"[{lang}] restored {fixed} strings with broken placeholders")
            save_cache(lang, mapping)
        translated = apply_map(en, mapping)
        write_chunks(lang, translated)
        out = OUT_DIR / f"{lang}.ts"
        out.write_text(to_ts(lang, translated), encoding="utf-8")
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()
