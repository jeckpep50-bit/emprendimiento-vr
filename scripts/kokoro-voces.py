"""Sintetiza una lista de líneas con Kokoro-82M (voz neuronal local).

Uso: python kokoro-voces.py lista.json modelo.onnx voces.bin
lista.json: [{ "wav": ruta, "texto": str, "voz": "ff_siwis", "idioma": "fr-fr", "velocidad": 0.9 }]
Lo llama scripts/generar-voces.mjs cuando la lección tiene "voces.motor": "kokoro".
"""
import json
import sys

import soundfile as sf
from kokoro_onnx import Kokoro


def main():
    ruta_lista, modelo, voces = sys.argv[1:4]
    with open(ruta_lista, encoding="utf-8") as f:
        lista = json.load(f)
    kokoro = Kokoro(modelo, voces)
    for linea in lista:
        muestras, muestreo = kokoro.create(
            linea["texto"],
            voice=linea["voz"],
            speed=float(linea.get("velocidad", 1.0)),
            lang=linea.get("idioma", "fr-fr"),
        )
        sf.write(linea["wav"], muestras, muestreo, subtype="PCM_16")
    print(f"kokoro: {len(lista)} lineas")


if __name__ == "__main__":
    main()
