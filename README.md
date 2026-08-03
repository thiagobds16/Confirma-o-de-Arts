# Baiano Confirma

App estático (HTML/CSS/JS puro) para enviar imagens, vídeos e documentos e avaliá-los (aprovar/reprovar), com tudo sincronizado em tempo real entre quem acessar o link. Não precisa de servidor:

- **Cloudinary** guarda os arquivos (imagens, vídeos, áudios de reprovação)
- **Firebase Firestore** guarda a lista de confirmações (quem mandou, status, aprovações), compartilhada entre todo mundo que abrir o link

## Como configurar

### 1. Cloudinary (armazenamento dos arquivos)

1. Crie uma conta grátis em https://cloudinary.com
2. No Console, copie o **Cloud name** (aparece no topo do Dashboard)
3. Vá em Settings (ícone de engrenagem) → Upload → role até "Upload presets"
4. Clique em "Add upload preset", mude o **Signing Mode** para **Unsigned**, salve
5. Copie o nome do preset

### 2. Firebase (lista compartilhada de confirmações)

1. Vá em https://console.firebase.google.com e crie um projeto (grátis)
2. Clique no ícone **"</>"** (Adicionar app da Web), dê um nome e registre
3. Copie os valores do objeto `firebaseConfig` que aparece
4. No menu lateral, vá em **Firestore Database** → "Criar banco de dados" (pode escolher "modo de teste")
5. Na aba **Regras** do Firestore, cole:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /arquivos/{doc} {
         allow read, write: if true;
       }
     }
   }
   ```
   (isso libera leitura/escrita pra quem tiver o link do site — combina com o espírito do app, que já é aberto pra qualquer pessoa confirmar)

### 3. Preencher o script.js

Abra `js/script.js` e preencha os dois blocos de configuração no topo com os valores que você copiou:

```js
const CLOUDINARY_CONFIG = {
    cloudName: 'seu-cloud-name',
    uploadPreset: 'nome-do-seu-preset'
};

const FIREBASE_CONFIG = {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...'
};
```

### 4. Publicar

1. Suba todo o conteúdo desta pasta pro seu repositório no GitHub
2. Ative o GitHub Pages (Settings → Pages → Deploy from branch → `main` → `/root`)
3. Acesse o link — pronto, qualquer pessoa que entrar vê e confirma os mesmos arquivos, em tempo real

## Por que Cloudinary + Firebase em vez de guardar tudo no GitHub

A primeira versão deste app subia os arquivos como commits direto no repositório do GitHub, usando um token de acesso pessoal embutido no `script.js`. Como o site é público, o GitHub detecta e revoga automaticamente qualquer token seu que apareça em texto num repositório público — o upload parava de funcionar segundos depois de cada commit.

O Cloudinary resolve isso porque o "unsigned upload preset" foi feito pra uploads direto do navegador: o que fica no código é só o nome da conta e do preset, que não são segredos.

Só que guardar os arquivos em algum lugar não bastava: a lista de quem mandou o quê, e o status de aprovação/reprovação, também precisava ser vista por todo mundo — e isso não dava pra fazer só com Cloudinary. O Firebase Firestore resolve essa parte: é um banco de dados na nuvem, gratuito, que sincroniza em tempo real entre todos os navegadores conectados, sem precisar de servidor próprio. As chaves do Firebase também não são segredos — a segurança de verdade fica nas "Regras" do Firestore, não em esconder essas chaves.

## Sobre exclusão de arquivos

Sem um backend, não dá pra apagar os arquivos do Cloudinary com segurança pelo navegador (isso exigiria expor a API Secret da conta). Por isso, o botão de excluir no app remove o registro da lista compartilhada (Firestore) — o arquivo em si continua guardado na sua conta do Cloudinary. Se quiser apagar de vez, acesse **Media Library** no Console do Cloudinary.

## Limite de tamanho

O plano gratuito do Cloudinary tem um limite de tamanho por arquivo (verifique o valor atual em cloudinary.com/pricing, pois pode mudar). Se um arquivo for rejeitado por tamanho, o Cloudinary retorna uma mensagem de erro que aparece na tela.
