// ===== CONFIGURAÇÃO DO CLOUDINARY (armazenamento das imagens/vídeos) =====
// O Cloudinary tem um modo de "upload sem assinatura" (unsigned) feito
// exatamente para uploads direto do navegador, sem precisar de nenhum
// segredo no código — por isso não tem token pra vazar ou ser revogado.
//
// COMO CONFIGURAR:
// 1. Crie uma conta grátis em https://cloudinary.com
// 2. No Console, copie o "Cloud name" (aparece no topo do Dashboard)
// 3. Vá em Settings (ícone de engrenagem) > Upload > Upload presets
// 4. Clique em "Add upload preset", mude o Signing Mode para "Unsigned", salve
// 5. Copie o nome do preset e preencha os dois campos abaixo
const CLOUDINARY_CONFIG = {
    cloudName: 'SEU_CLOUD_NAME',       // ex: dxyzabc123
    uploadPreset: 'SEU_UPLOAD_PRESET'  // ex: baiano_confirma_uploads
};

// ===== CONFIGURAÇÃO DO FIREBASE (lista compartilhada de confirmações) =====
// Diferente do token do GitHub, essas chaves do Firebase são feitas pra
// ficar públicas no código do navegador — a segurança de verdade fica nas
// "Regras" (Security Rules) do Firestore, configuradas no console.
//
// COMO CONFIGURAR:
// 1. Vá em https://console.firebase.google.com e crie um projeto (grátis)
// 2. No projeto, clique no ícone "</>" (Adicionar app da Web), dê um nome e registre
// 3. O Firebase mostra um objeto firebaseConfig — copie os valores pra baixo
// 4. No menu lateral, vá em "Firestore Database" > "Criar banco de dados"
//    (pode escolher "modo de teste" pra começar rápido)
// 5. Na aba "Regras" do Firestore, use algo como:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /arquivos/{doc} {
//          allow read, write: if true;
//        }
//      }
//    }
//    (isso libera leitura/escrita pra quem tiver o link do site — combina
//    com o espírito do app, que já é aberto pra qualquer pessoa confirmar)
const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyA9KXRqOUAqFq618MkEg0HKLFf9ELn36FI',
    authDomain: 'baiano-confirma.firebaseapp.com',
    projectId: 'baiano-confirma',
    storageBucket: 'baiano-confirma.firebasestorage.app',
    messagingSenderId: '26899881448',
    appId: '1:26899881448:web:8b559a4df8e62e82af585d'
};

let db = null;
let filesCollection = null;
function checkFirebaseConfig() {
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === 'SUA_API_KEY') {
        throw new Error('Configuração do Firebase não preenchida. Edite FIREBASE_CONFIG no topo de js/script.js.');
    }
}
function initFirebase() {
    checkFirebaseConfig();
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    filesCollection = db.collection('arquivos');
    filesCollection.orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (currentTab === 'confirm') renderFiles();
    }, erro => {
        console.error(erro);
        alert(`Erro ao conectar com o Firebase: ${erro.message}`);
    });
}

let currentUser = null;
let files = [];
let currentTab = 'confirm';
let pendingRejectId = null;

let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let recInterval = null;
let recSeconds = 0;

let pendingUploads = [];

function init() {
    try {
        initFirebase();
    } catch (e) {
        alert(e.message);
    }

    const savedUser = localStorage.getItem('baiano_user');
    if (savedUser) document.getElementById('nameInput').value = savedUser;

    document.getElementById('dropZone').addEventListener('click', () => document.getElementById('fileInput').click());
}

function doLogin() {
    const name = document.getElementById('nameInput').value.trim();
    if (!name) {
        const inp = document.getElementById('nameInput');
        inp.style.borderColor = 'var(--danger)';
        setTimeout(() => inp.style.borderColor = 'var(--border)', 2000);
        return;
    }
    currentUser = name;
    localStorage.setItem('baiano_user', name);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('userPill').style.display = 'flex';
    document.getElementById('userNameDisplay').textContent = name;
    renderFiles();
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab${tab === 'confirm' ? 'Confirm' : 'Upload'}`).classList.add('active');
    document.getElementById('viewConfirm').style.display = tab === 'confirm' ? 'block' : 'none';
    document.getElementById('viewUpload').style.display = tab === 'upload' ? 'block' : 'none';
    if (tab === 'confirm') renderFiles();
}

const dz = document.getElementById('dropZone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

function handleFiles(fileList) {
    document.getElementById('previewList').innerHTML = '';
    pendingUploads = [];
    Array.from(fileList).forEach((file, i) => {
        const r = new FileReader();
        r.onload = e => {
            const tipo = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
            const obj = { id: `pend_${Date.now()}_${i}`, type: tipo, name: file.name, arquivo: file, preview: e.target.result };
            pendingUploads.push(obj);
            addPreview(obj);
        };
        r.readAsDataURL(file);
    });
}

function addPreview(obj) {
    const l = document.getElementById('previewList');
    const ic = obj.type === 'image' ? '🖼️' : obj.type === 'video' ? '🎬' : '📄';
    l.innerHTML += `
        <div class="preview-item" id="${obj.id}">
            <div class="preview-thumb">${obj.type === 'image' ? `<img src="${obj.preview}">` : ic}</div>
            <div class="preview-info">
                <div class="preview-name">${escapeHtml(obj.name)}</div>
                <div class="preview-meta">${(obj.arquivo.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <button class="btn-remove-preview" onclick="remPend('${obj.id}')">✕</button>
            <button class="btn-send" onclick="enviaServidor('${obj.id}')">Enviar</button>
        </div>`;
}

function remPend(id) {
    pendingUploads = pendingUploads.filter(x => x.id !== id);
    document.getElementById(id)?.remove();
}

// ===== HELPERS DE INTEGRAÇÃO COM O CLOUDINARY =====
function checkCloudinaryConfig() {
    if (!CLOUDINARY_CONFIG.cloudName || CLOUDINARY_CONFIG.cloudName === 'SEU_CLOUD_NAME' ||
        !CLOUDINARY_CONFIG.uploadPreset || CLOUDINARY_CONFIG.uploadPreset === 'SEU_UPLOAD_PRESET') {
        throw new Error('Configuração do Cloudinary não preenchida. Edite CLOUDINARY_CONFIG no topo de js/script.js.');
    }
}

// Sobe o arquivo direto pro Cloudinary usando um preset "unsigned" (sem segredo no código)
async function cloudinaryUpload(file) {
    checkCloudinaryConfig();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.error?.message || 'Erro ao enviar para o Cloudinary');

    return {
        nome: file.name,
        publicId: dados.public_id,
        url: dados.secure_url
    };
}

// ===== ENVIA ARQUIVO DIRETO PARA O CLOUDINARY =====
async function enviaServidor(id) {
    const arq = pendingUploads.find(x => x.id === id);
    if (!arq) return;

    const item = document.getElementById(arq.id);
    const btn = item?.querySelector('.btn-send');
    if (btn) { btn.textContent = 'Enviando...'; btn.disabled = true; }

    try {
        const dados = await cloudinaryUpload(arq.arquivo);

        await filesCollection.add({
            type: arq.type,
            name: dados.nome,
            publicId: dados.publicId,
            url: dados.url,
            sender: currentUser,
            timestamp: new Date().toISOString(),
            status: 'pending',
            approvedBy: null,
            rejectedBy: null,
            rejectComment: null,
            rejectAudio: null
        });

        remPend(id);
        if (pendingUploads.length === 0) {
            document.getElementById('fileInput').value = '';
            switchTab('confirm');
        }
    } catch (erro) {
        alert(`Erro: ${erro.message}`);
        if (btn) { btn.textContent = 'Enviar'; btn.disabled = false; }
    }
}

function renderFiles() {
    const c = document.getElementById('filesContainer');
    const v = document.getElementById('emptyState');
    if (files.length === 0) { v.style.display = 'block'; c.innerHTML = ''; return; }
    v.style.display = 'none'; c.innerHTML = '';

    const imgs = files.filter(f => f.type === 'image');
    const vids = files.filter(f => f.type === 'video');
    const docs = files.filter(f => f.type === 'document');

    if (imgs.length) c.innerHTML += sec('🖼️', 'Fotos', imgs);
    if (vids.length) c.innerHTML += sec('🎬', 'Vídeos', vids);
    if (docs.length) c.innerHTML += sec('📄', 'Documentos', docs);
}

function sec(ic, tit, arr) {
    let h = `<div class="section-header"><span class="section-icon">${ic}</span><span class="section-title">${tit}</span><span class="section-count">${arr.length}</span></div>`;
    arr.forEach(f => h += card(f));
    return h;
}

function card(f) {
    const caminho = f.url;
    let mid = '';
    if (f.type === 'image') {
        mid = `<div class="file-media"><img src="${caminho}" onclick="openLightbox('${caminho}')">
        <div class="file-overlay"><span class="file-badge">👤 ${escapeHtml(f.sender)}</span>
        <button class="btn-delete" onclick="del('${f.id}')">✕</button></div></div>`;
    } else if (f.type === 'video') {
        mid = `<div class="file-media"><video src="${caminho}" controls></video>
        <div class="file-overlay"><span class="file-badge">👤 ${escapeHtml(f.sender)}</span>
        <button class="btn-delete" onclick="del('${f.id}')">✕</button></div></div>`;
    } else {
        mid = `<div class="file-media"><div class="file-media-doc"><div class="doc-icon">📄</div>
        <div class="doc-name">${escapeHtml(f.name)}</div>
        <a href="${caminho}" download="${escapeHtml(f.name)}" class="btn-download">Baixar</a></div>
        <div class="file-overlay" style="top:auto;bottom:12px;right:12px;"><button class="btn-delete" onclick="del('${f.id}')">✕</button></div></div>`;
    }

    let act = '';
    if (f.status === 'pending') {
        act = `<div class="file-actions"><div class="action-pending">
        <button class="btn-approve" onclick="aprov('${f.id}')">APROVAR</button>
        <button class="btn-reject" onclick="abreModal('${f.id}')">REPROVAR</button></div></div>`;
    } else if (f.status === 'approved') {
        act = `<div class="file-actions"><div class="action-approved">
        <div class="action-approved-header">✅ APROVADO</div>
        <div class="action-approved-by">Por: <span>${escapeHtml(f.approvedBy)}</span></div>
        <button class="btn-change-mind" onclick="muda('${f.id}')">Mudei de ideia</button></div></div>`;
    } else {
        let txt = f.rejectComment ? `<div class="reject-comment-text">${escapeHtml(f.rejectComment)}</div>` : '';
        let aud = f.rejectAudio ? `<audio controls src="${f.rejectAudio}">` : '';
        act = `<div class="file-actions"><div class="action-rejected">
        <div class="action-rejected-header">❌ REPROVADO</div>
        <div class="action-rejected-by">Por: <span>${escapeHtml(f.rejectedBy)}</span></div>
        ${txt}${aud ? `<div class="audio-comment-box">${aud}</div>` : ''}
        <button class="btn-change-mind" onclick="muda('${f.id}')">Mudei de ideia</button></div></div>`;
    }
    return `<div class="file-card">${mid}${act}</div>`;
}

async function aprov(id) {
    try {
        await filesCollection.doc(id).update({ status: 'approved', approvedBy: currentUser });
    } catch (e) { alert(`Erro: ${e.message}`); }
}
function abreModal(id) { pendingRejectId = id; document.getElementById('rejectModal').classList.add('active'); limpaRec(); }
function closeRejectModal() { document.getElementById('rejectModal').classList.remove('active'); limpaRec(); pendingRejectId = null; }
async function confirmReject() {
    if (!pendingRejectId) return;
    const btn = document.querySelector('#rejectModal .modal-btn-confirm');
    if (btn) { btn.disabled = true; }
    try {
        let rejectAudioUrl = null;
        if (audioBlob) {
            const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
            const dados = await cloudinaryUpload(audioFile);
            rejectAudioUrl = dados.url;
        }
        await filesCollection.doc(pendingRejectId).update({
            status: 'rejected',
            rejectedBy: currentUser,
            rejectComment: document.getElementById('rejectText').value.trim() || null,
            rejectAudio: rejectAudioUrl
        });
        closeRejectModal();
    } catch (e) {
        alert(`Erro: ${e.message}`);
    } finally {
        if (btn) { btn.disabled = false; }
    }
}
async function muda(id) {
    try {
        await filesCollection.doc(id).update({ status: 'pending', approvedBy: null, rejectedBy: null, rejectComment: null, rejectAudio: null });
    } catch (e) { alert(`Erro: ${e.message}`); }
}

// ===== REMOVE ARQUIVO DA LISTA (COMPARTILHADA) =====
// O upload "unsigned" do Cloudinary não permite apagar o arquivo original
// pelo navegador sem expor outro segredo (a API Secret da conta). Por isso,
// isso aqui remove o registro do Firestore — o arquivo em si continua
// guardado na sua conta do Cloudinary, e pode ser apagado por lá se quiser
// (Console > Media Library) caso precise liberar espaço.
async function del(id) {
    if (!confirm('Remover esse arquivo da lista pra todo mundo? (o arquivo continua salvo na sua conta Cloudinary; para apagar de vez, use o Media Library do Cloudinary)')) return;
    try {
        await filesCollection.doc(id).delete();
    } catch (e) { alert(`Erro: ${e.message}`); }
}

async function toggleRec() {
    const btn = document.getElementById('micBtn');
    const wave = document.getElementById('wave');
    if (!mediaRecorder) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(s);
        audioChunks = []; recSeconds = 0;
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => { audioBlob = new Blob(audioChunks, {type:'audio/webm'}); mostraAudio(); };
        mediaRecorder.start(); btn.classList.add('recording'); wave.classList.remove('stopped');
        recInterval = setInterval(() => { recSeconds++; const m=Math.floor(recSeconds/60), s=recSeconds%60; document.getElementById('recTimer').textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`; }, 1000);
    } else {
        mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t=>t.stop()); clearInterval(recInterval);
        mediaRecorder = null; btn.classList.remove('recording'); wave.classList.add('stopped');
    }
}
function mostraAudio() {
    document.getElementById('audioPlayerContainer').innerHTML = `<div class="audio-player-row"><audio controls src="${URL.createObjectURL(audioBlob)}"><button class="btn-audio-delete" onclick="limpaRec()">✕</button></div>`;
}
function limpaRec() {
    clearInterval(recInterval); recSeconds = 0; document.getElementById('recTimer').textContent = '00:00';
    if (mediaRecorder) { mediaRecorder.stop(); mediaRecorder.stream.getTracks().forEach(t=>t.stop()); mediaRecorder = null; }
    audioBlob = null; document.getElementById('audioPlayerContainer').innerHTML = '';
    document.getElementById('rejectText').value = '';
}

function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('active'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }

function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}