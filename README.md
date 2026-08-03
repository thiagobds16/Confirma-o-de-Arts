# Baiano Confirma

App estático (HTML/CSS/JS puro) para enviar imagens, vídeos e documentos e avaliá-los (aprovar/reprovar). Não precisa de servidor: as mídias são enviadas direto pro Cloudinary usando um "unsigned upload preset" — sem nenhum segredo exposto no código.

## Como configurar

1. Crie uma conta grátis em https://cloudinary.com
2. No Console (Dashboard), copie o **Cloud name** que aparece no topo.
3. Vá em **Settings** (ícone de engrenagem) → **Upload** → role até **Upload presets**.
4. Clique em **Add upload preset**.
5. Mude o **Signing Mode** de "Signed" para **"Unsigned"** e salve.
6. Copie o **nome do preset** (aparece na listagem).
7. Abra `js/script.js` e preencha o bloco `CLOUDINARY_CONFIG` no topo:
   ```js
   const CLOUDINARY_CONFIG = {
       cloudName: 'seu-cloud-name',
       uploadPreset: 'nome-do-seu-preset'
   };
   ```
8. Suba todo o conteúdo desta pasta pro seu repositório no GitHub.
9. Ative o GitHub Pages (Settings → Pages → Deploy from branch → `main` → `/root`).
10. Acesse o link do GitHub Pages — pronto, qualquer pessoa que entrar pode enviar e avaliar arquivos.

## Por que Cloudinary em vez de guardar no próprio repositório

A primeira versão deste app subia os arquivos como commits direto no repositório do GitHub, usando um token de acesso pessoal embutido no `script.js`. Só que, como o site é público, o GitHub detecta e revoga automaticamente qualquer token seu que apareça em texto num repositório público — então o upload parava de funcionar segundos depois de cada commit.

O Cloudinary resolve isso porque o "unsigned upload preset" foi feito exatamente para uploads direto do navegador: o que fica no código é só o nome da conta (cloud name) e o nome do preset, que **não são segredos** — não tem token nenhum pra vazar ou ser revogado.

## Sobre exclusão de arquivos

Sem um backend, não dá pra apagar os arquivos do Cloudinary com segurança pelo navegador (isso exigiria expor a API Secret da conta, o que anularia a vantagem de segurança do modo unsigned). Por isso, o botão de excluir no app só remove o arquivo da lista/confirmação — o arquivo em si continua guardado na sua conta do Cloudinary. Se quiser apagar de vez, acesse **Media Library** no Console do Cloudinary.

## Limite de tamanho

O plano gratuito do Cloudinary tem um limite de tamanho por arquivo (verifique o valor atual em cloudinary.com/pricing, pois pode mudar). Se um arquivo for rejeitado por tamanho, o Cloudinary retorna uma mensagem de erro que aparece na tela.
