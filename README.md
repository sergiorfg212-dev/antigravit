<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d5094a90-0c93-4651-831e-34b4129896b6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Acceso desde Dispositivos Móviles en Red Local

Dado que la aplicación está diseñada para ser responsiva y funcionar en celular, puedes acceder a ella mientras corre en tu computadora:

1. **Obtener IP de la Computadora**:
   - Abre la terminal (PowerShell o CMD) en Windows.
   - Ejecuta el comando: `ipconfig`
   - Busca la dirección de tu adaptador Wi-Fi o Ethernet (generalmente empieza con `192.168.x.x` o `10.0.x.x`). Ej: `192.168.1.75`.

2. **Conectar el Celular**:
   - Asegúrate de que tu celular y tu computadora estén conectados a la **misma red Wi-Fi**.

3. **Abrir en el Navegador del Celular**:
   - Ingresa al navegador del celular (Safari, Chrome) y escribe la IP seguida del puerto `3000`.
   - Ejemplo: `http://192.168.1.75:3000`

## Instalación como Aplicación Móvil (PWA)

Esta app cuenta con un manifiesto web PWA y Service Worker. Para instalarla y usarla como si fuera una app nativa en tu celular:

- **Android (Chrome)**: Al ingresar al enlace, aparecerá un banner automático en la parte inferior que dice "Agregar a la pantalla principal" o bien presiona los 3 puntos de menú de Chrome y selecciona **"Instalar aplicación"** / **"Agregar a pantalla de inicio"**.
- **iOS/iPhone (Safari)**: Presiona el botón de compartir (el icono del cuadrado con una flecha hacia arriba) y selecciona **"Agregar a inicio"** (Add to Home Screen). Esto creará un icono directo que oculta las barras del navegador para una experiencia 100% de app móvil.

