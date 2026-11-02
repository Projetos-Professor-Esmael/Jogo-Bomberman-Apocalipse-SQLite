# BOMBERMAN APOCALIPSE 2D

## Estrutura simplificada
Todos os arquivos do projeto ficam diretamente nesta pasta:

- `index.html` — página principal do jogo
- `game.css` — estilos e interface
- `game.js` — lógica, renderização Canvas 2D e salvamento SQLite
- `README.md` — este manual
- `bomberman_progresso.db` — criado quando você salva a campanha

Não há subpastas, servidor, PHP, MySQL, WebGL ou bibliotecas externas obrigatórias.

## Como executar
1. Extraia a pasta `BOMBERMAN_APOCALIPSE_2D` para o local desejado.
2. Abra `index.html` no Microsoft Edge ou Google Chrome atualizado.
3. Inicie ou continue uma campanha.

## Salvar na própria pasta do jogo
1. Clique em `SALVAR NA PASTA DO JOGO (.DB)` no menu ou pause a partida e use o botão de salvamento.
2. Na janela de seleção, escolha exatamente a pasta `BOMBERMAN_APOCALIPSE_2D`, aquela que contém `index.html`.
3. Autorize o acesso. O arquivo `bomberman_progresso.db` será criado ou atualizado nessa mesma pasta.
4. Nas próximas gravações, selecione novamente essa pasta. O arquivo existente será substituído pelo progresso mais recente.

**Limitação de segurança do navegador:** uma página aberta localmente não pode gravar em uma pasta sem autorização explícita. Por isso, o navegador abre o seletor de pasta a cada salvamento. Se o navegador não oferecer a API de acesso a pastas, o jogo fará o download convencional do `.db`.

## Importar progresso
Use `IMPORTAR PROGRESSO (.DB)` e selecione `bomberman_progresso.db` dentro da pasta do projeto. A importação valida o banco antes de restaurar a campanha.

## Compatibilidade
O jogo usa Canvas 2D e foi mantido sem dependência de WebGL, adequado a computadores com placas gráficas antigas. O arquivo `.db` exportado usa cabeçalho e estrutura SQLite.
