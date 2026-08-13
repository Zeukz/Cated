# Cated

Aplicativo desktop privado de comunicação entre amigos para Windows, construído com Electron, React, Vite e Supabase.

## Funcionalidades atuais

O Cated possui contas com Supabase Auth, comunidades, canais de texto e voz, mensagens em tempo real, amizades, convites, cargos, presença, moderação, mensagens de áudio com waveform, configurações de microfone e saída de áudio, volume geral, sensibilidade do microfone e compartilhamento de tela.

## Desenvolvimento no Windows

Instale o Node.js LTS. Na pasta do projeto, configure o arquivo `.env` com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Depois execute:

```powershell
npm install
npm run dev
```

O arquivo `.env` não deve ser enviado ao GitHub. O repositório já possui regras para ignorar credenciais, dependências e builds locais.

## Gerar o instalador manualmente

Para criar o instalador Windows sem publicar uma versão, execute:

```powershell
npm run dist
```

O resultado será criado em `release/Cated-Setup-VERSAO.exe`, junto com `latest.yml` e o arquivo `.blockmap`. O alvo `nsis` é necessário para o atualizador automático no Windows.

## Publicar uma nova versão

Atualize o campo `version` do `package.json` usando versionamento semântico. Por exemplo, depois de `0.1.0`, use `0.2.0` para uma nova funcionalidade ou `0.1.1` para uma correção:

```powershell
npm version patch
# ou
npm version minor
```

Depois crie e envie a tag correspondente:

```powershell
git push origin main
git push origin --tags
```

O workflow do GitHub Actions será iniciado quando uma tag `v*` for enviada. Ele instalará as dependências, compilará o aplicativo, criará o instalador Windows e publicará os artefatos na seção **Releases** do GitHub usando o `GITHUB_TOKEN` automático do repositório.

Também é possível criar o release localmente, se necessário:

```powershell
npm run release:publish
```

## Como os amigos recebem atualizações

A instalação deve ser feita pelo arquivo `.exe` de um release publicado no GitHub. O aplicativo instalado consulta o repositório `Zeukz/Cated` ao iniciar e periodicamente enquanto estiver aberto. Quando uma versão mais recente é encontrada, o Cated mostra uma notificação, baixa o instalador em segundo plano e oferece o botão **Reiniciar e atualizar**.

Cada nova versão precisa ter um número maior que o anterior. Não reutilize uma versão que já foi publicada. Se uma versão quebrada precisar ser substituída, publique outra versão maior, como `0.1.2` depois de `0.1.1`.

## Supabase

As migrações SQL ficam na raiz do projeto. Execute-as no SQL Editor do Supabase na ordem em que foram criadas. A chave pública do Supabase pode ser usada no cliente; nunca coloque uma chave `service_role` no aplicativo ou no repositório.

## Repositório

O código público e os releases estão em [github.com/Zeukz/Cated](https://github.com/Zeukz/Cated).
