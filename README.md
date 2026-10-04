# olivia-eras-relay

Puente de YouTube para el wallpaper **Olivia Rodrigo · Ultimate Eras** (Wallpaper Engine).

Wallpaper Engine abre los wallpapers web como archivo local, y YouTube no reproduce videos
incrustados sin un origen https ("error 153"). Esta página, publicada con GitHub Pages,
contiene un reproductor de YouTube silenciado que el wallpaper controla por `postMessage`
(cargar, buscar, reproducir, pausar, consultar el tiempo y liberar) para sincronizar el
videoclip con la canción que suena en Spotify.

- No guarda ni envía ningún dato: solo reproduce videos oficiales desde YouTube.
- No usa temporizadores; la API de YouTube se carga solo cuando suena una canción.

URL: https://tkyoxx.github.io/olivia-eras-relay/
