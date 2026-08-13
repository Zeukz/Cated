# Amigos

Aplicativo desktop privado para comunicação entre amigos, construído para Windows com Electron, React e Vite.

## Estado atual

Esta primeira versão entrega a base visual e interativa do cliente desktop. Ela já contém a navegação por comunidade, canais de texto, lista de membros, envio de mensagens locais de demonstração, painel de perfil, configurações, controles de microfone e áudio e o fluxo inicial de compartilhamento de tela.

A comunicação entre computadores, as contas reais e a persistência das mensagens serão conectadas na próxima etapa por meio de um servidor Node.js com comunicação em tempo real. A interface foi criada para receber esses recursos sem precisar ser refeita.

## Como executar no Windows

Instale o [Node.js](https://nodejs.org/) em uma versão LTS. Depois, abra o PowerShell nesta pasta e execute:

```powershell
npm install
npm run dev
```

O comando de desenvolvimento abre a janela do aplicativo e atualiza a interface quando os arquivos são alterados.

## Como gerar o instalador

Para criar um instalador `.exe` para distribuir aos seus amigos, execute:

```powershell
npm run dist
```

O instalador será criado na pasta `release`. Cada amigo poderá instalar o cliente no próprio computador.

## Próximas etapas

A próxima etapa é conectar um servidor privado com autenticação, salas e mensagens sincronizadas entre os computadores. Depois serão integradas as salas de voz usando WebRTC e o compartilhamento de tela com permissões do Electron. Para que os amigos se conectem de fora da sua rede, o servidor precisará ser hospedado em um computador ou serviço online com endereço público.
