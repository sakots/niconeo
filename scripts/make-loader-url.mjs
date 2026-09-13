import { writeFile } from "node:fs/promises";

// Keep this in sync with the GitHub repository that publishes this project.
const repository = "sakots/niconeo";
const branch = "main";
const api = `https://api.github.com/repos/${repository}/commits/${branch}`;
const cdn = `https://cdn.jsdelivr.net/gh/${repository}@`;

// Resolve main to a commit SHA before loading. That avoids a partially updated
// branch being cached as the application. If GitHub's API is unavailable, use
// main with a cache buster so the bookmarklet remains usable.
const bookmarklet = `javascript:(async()=>{const i='nico-neo-loader';if(document.getElementById(i))return;let v='${branch}';try{const r=await fetch('${api}',{cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github+json'},referrerPolicy:'no-referrer'});if(r.ok){const j=await r.json();if(typeof j.sha==='string'&&/^[0-9a-f]{40}$/.test(j.sha))v=j.sha}}catch{}const s=document.createElement('script');s.id=i;s.charset='UTF-8';s.src='${cdn}'+v+'/dist/bookmarklet.js'+(v==='${branch}'?'?v='+Date.now():'');s.onerror=()=>{s.remove();alert('NicoNEOの読み込みに失敗しました。')};(document.head||document.documentElement).appendChild(s)})()`;
await writeFile("dist/bookmarklet-loader.url.txt", `${bookmarklet}\n`);
console.log(`Generated loader: ${bookmarklet.length} characters`);
