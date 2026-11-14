// Tradução EN -> PT-BR aplicada na EXIBIÇÃO (hook do motor): o jogo continua usando as strings originais
// em inglês (lógica, saves, __find dos testes); só o que é desenhado passa por `tr`.
//   • textos de TextField: dicionário exato (EXACT, chave sem espaços nas pontas) + padrões (PATTERNS) para
//     frases montadas com variáveis; HTML (`<font color>`) é traduzido trecho a trecho, preservando as tags;
//   • textos estáticos (DefineText): STATIC, por id do caractere no SWF.
// Idioma: escolha manual (localStorage) > navegador (navigator.languages[0] começando com "pt") > EN.
import { player, retranslate, setTextHook } from '../engine/core';
import { measure } from '../engine/text';

export type Lang = 'en' | 'pt';
const KEY = 'evolution.lang';
const subs = new Set<() => void>();

function detect(): Lang {
  try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'pt') return v; } catch { /* sem storage */ }
  const l = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'en';
  return /^pt/i.test(l) ? 'pt' : 'en';
}
let lang: Lang = detect();
export const getLang = () => lang;
export function onLangChange(f: () => void) { subs.add(f); }
export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* */ }
  refresh();
}
/** reaplica o idioma: refaz o layout dos campos e reexecuta o dimensionamento dos botões (script Frame do sprite 57) */
function refresh() {
  retranslate();
  const walk = (o: any) => {
    if (o.tLabel && typeof o.Frame === 'function') o.Frame();
    for (const c of o.children || []) walk(c);
  };
  const root = player()?.root;
  if (root) walk(root);
  subs.forEach(f => f());
}

/** botões ancorados à direita de um painel: em PT o rótulo é mais largo, então o botão recua o excedente */
const RIGHT_ANCHORED = new Set(['BACK']);
/** rótulo PT mais longo pode estourar painel/borda direita: recua o botão (desfaz o recuo anterior; sem efeito em EN) */
export function fitRight(mc: any) {
  if (mc._i18nDx) { mc._x += mc._i18nDx; mc._i18nDx = 0; }
  if (lang !== 'pt' || !mc.tLabel) return;
  let dx = 0;
  const en = String(mc.sLabel ?? '');
  if (RIGHT_ANCHORED.has(en.trim()) && mc.autoSize === 'left') dx = mc.tLabel._width - (measure(mc.tLabel.style(), en) + 4);
  const over = mc.getBounds?.()?.xMax - dx - (640 - 6);
  if (over > 0) dx += over;
  if (dx > 0) { mc._x -= dx; mc._i18nDx = dx; }
}

// ───────────────────────── dicionário ─────────────────────────
const EXACT: Record<string, string> = {
  // menu / telas
  'PLAY GAME': 'JOGAR', 'INSTRUCTIONS': 'INSTRUÇÕES', 'VIEW HIGHSCORES': 'VER RECORDES', 'DOWNLOAD GAMES': 'BAIXAR JOGOS',
  'MORE ONLINE GAMES': 'MAIS JOGOS ONLINE', 'ADD THIS GAME TO YOUR SITE': 'ADICIONE ESTE JOGO AO SEU SITE',
  'Credits': 'Créditos', 'Copyright 2007 freeworldgroup.com': 'Copyright 2007 freeworldgroup.com', 'CONTINUE': 'CONTINUAR', 'LOAD GAME': 'CARREGAR JOGO', 'MUSIC CREDITS': 'CRÉDITOS DA MÚSICA',
  'By phoenixfirex': 'Por phoenixfirex', 'NAME :': 'NOME :', 'NEW GAME': 'NOVO JOGO',
  'CHANGE PLAYER': 'TROCAR JOGADOR', 'SELECT GAME': 'SELECIONAR JOGO', 'NEW PLAYER': 'NOVO JOGADOR',
  'DELETE PLAYER': 'EXCLUIR JOGADOR', 'SELECT PLAYER': 'SELECIONAR JOGADOR', 'NO DATA': 'SEM DADOS',
  'NEW PLAYER NAME :': 'NOME DO NOVO JOGADOR :', 'START GAME': 'INICIAR JOGO', 'Loading...': 'Carregando...',
  'MAIN MENU': 'MENU PRINCIPAL', 'CONTINUE PLAYING': 'CONTINUAR JOGANDO', 'SUBMIT SCORE': 'ENVIAR PONTUAÇÃO',
  'QUIT TO MENU': 'SAIR PARA O MENU', 'RETURN TO GAME': 'VOLTAR AO JOGO', 'SCORE:': 'PONTUAÇÃO:', 'SCORE :': 'PONTUAÇÃO :',
  'Submit': 'Enviar', 'Quality :': 'Qualidade :', 'Sound :': 'Som :', 'Music :': 'Música :',
  'LOW': 'BAIXA', 'MEDIUM': 'MÉDIA', 'HIGH': 'ALTA', 'BEST': 'MÁXIMA',
  // botões de popup
  'SETTINGS': 'CONFIGURAÇÕES', 'CLOSE': 'FECHAR', 'SKIP RACE': 'PULAR CORRIDA',
  'OK': 'OK', 'NEXT': 'PRÓXIMO', 'BACK': 'VOLTAR', 'CANCEL': 'CANCELAR', 'YES': 'SIM', 'NO': 'NÃO', 'BUY': 'COMPRAR',
  'REMOVE SELL': 'RETIRAR', 'RESET PRICE': 'NOVO PREÇO', 'START FIGHT': 'INICIAR LUTA', 'START RACE': 'CORRER',
  // HUD
  'MONEY: $': 'DINHEIRO: $', 'Your bet: $': 'Aposta: $', 'Max bet: $': 'Máx.: $', 'YOU': 'VOCÊ',
  // listas / popups
  'BUGS YOU ARE OWN': 'SEUS INSETOS', 'BUGS YOU OWN': 'SEUS INSETOS', 'BUGS YOU ARE SELLING': 'INSETOS À VENDA',
  'Bug price is based on position in bug pyramid and age.': 'O preço do inseto depende da posição na pirâmide e da idade.',
  'A higher placed bug is worth more than a bug at the bottom of the pyramid.': 'Um inseto mais alto na pirâmide vale mais do que um da base.',
  'Hunger :': 'Fome :', 'Sex :': 'Sexo :', 'Size :': 'Tam. :', 'Happiness :': 'Felicidade :', 'Age :': 'Idade :', 'Name :': 'Nome :',
  'Health :': 'Saúde :', 'Attack :': 'Ataque :', 'Speed :': 'Velocidade :', 'Price :': 'Preço :',
  'Female': 'Fêmea', 'Male': 'Macho', 'No Name': 'Sem nome', 'Price : $': 'Preço : $',
  // caixas de confirmação / avisos
  'PLEASE ENTER A NAME !': 'DIGITE UM NOME !', 'ALREADY HAVE !\nCHANGE ANOTHER ONE !': 'JÁ EXISTE !\nESCOLHA OUTRO !',
  'Put the bug to \n sell list ?': 'Colocar \n à venda ?',
  "Change the bug's price \nor remove it from sell list?": 'Mudar o preço ou \ntirar da venda?',
  'New name !': 'Novo nome !', 'Sell IT ?': 'VENDER ?', 'Buy the bug ?': 'Comprar o inseto ?', 'BUY IT ?': 'COMPRAR ?',
  'Bug babies!': 'Filhotes!', 'Bug baby!': 'Filhote!',
  // dicas (popWord)
  'Good luck!': 'Boa sorte!', 'Your toy is broken!': 'Seu brinquedo quebrou!',
  'Give enough food for bugs or they will die!': 'Dê comida suficiente ou os insetos vão morrer!',
  'Each food has different energy values!': 'Cada comida tem um valor de energia diferente!',
  "Clean bug's poo!": 'Limpe o cocô dos insetos!',
  'You need to keep bugs happy or they will die!': 'Mantenha os insetos felizes ou eles vão morrer!',
  'Buy enough toys for bugs!': 'Compre brinquedos suficientes!', 'Some food can make bugs happy!': 'Algumas comidas deixam os insetos felizes!',
  'The bug is not old enough to sell!': 'O inseto ainda é novo demais para vender!',
  'Only 12 bugs you can fed!': 'Você só pode alimentar 12 insetos!',
  'The bug is not old enough to breed!': 'O inseto ainda é novo demais para cruzar!',
  'The bug is too old enough to breed!': 'O inseto é velho demais para cruzar!',
  'Enter a name please!': 'Digite um nome, por favor!', 'The bug is unhappy!': 'O inseto está infeliz!',
  "You don't have enough money!": 'Você não tem dinheiro suficiente!', 'You have too many toys!': 'Você tem brinquedos demais!',
  'Please select at least one bug!': 'Selecione pelo menos um inseto!', 'Bet too high!': 'Aposta alta demais!',
  'Not enough money to bet this amount!': 'Dinheiro insuficiente para essa aposta!',
  'Please select a male bug and a female bug!': 'Selecione um macho e uma fêmea!',
  'New bugs born!': 'Nasceram novos insetos!', 'New bug born!': 'Nasceu um novo inseto!',
  'There is too much food on the ground!': 'Há comida demais no chão!', 'Not available!': 'Indisponível!',
  // painel de informação (rótulos; o trecho colorido vem em outro segmento)
  'Apple :': 'Maçã :', 'Watermelon :': 'Melancia :', 'Grape :': 'Uva :', 'Drug :': 'Droga :',
  'Toys :': 'Brinquedos :', 'Time remaining :': 'Tempo restante :', "Bug's poo :": 'Cocô do inseto :', 'Click to clean it!': 'Clique para limpar!',
  'Hint :': 'Dica :', 'Hint:': 'Dica:', 'Too much bug poo will make bugs unhappy!': 'Cocô demais deixa os insetos infelizes!',
  'Amount remaining :': 'Quantidade restante :', 'Number remaining :': 'Quantidade restante :',
  'Your shop :': 'Sua loja :', 'Change game speed!': 'Mudar a velocidade do jogo!',
  'Breeding lab :': 'Laboratório de cruzamento :', 'Get new bug babies!': 'Tenha novos filhotes!',
  'Sell list :': 'Lista de venda :', 'You can add your bug to the sell list and': 'Você pode pôr seu inseto na lista de venda e',
  'wait for someone to buy it!': 'esperar alguém comprá-lo!', 'Do not over-price your bug or it will not sell!': 'Não ponha um preço alto demais ou ele não vende!',
  'Rename bug :': 'Renomear inseto :', "You can change your bug's name!": 'Você pode mudar o nome do seu inseto!',
  'Bug list :': 'Lista de insetos :', 'Pet market :': 'Mercado :', 'This is where you can buy food, toys, medicine': 'Aqui você compra comida, brinquedos, remédios',
  'and other bugs!': 'e outros insetos!', 'Your home :': 'Sua casa :',
  'Fighting and racing arena :': 'Arena de lutas e corridas :', 'This is where you can gamble': 'Aqui você aposta',
  'with your top bugs and try to win some money!': 'com seus melhores insetos e tenta ganhar dinheiro!',
  'Menu :': 'Menu :', 'Sound. Music. Language. Main menu.': 'Som. Música. Idioma. Menu principal.',
  'Shop Assistant :': 'Atendente da loja :', '5 basic bugs, food and toys.': '5 insetos básicos, comida e brinquedos.',
  'Private Sellers :': 'Vendedores particulares :', 'Some bugs or drug.': 'Alguns insetos ou droga.',
  'A competitor in the bug racing ring!': 'Um competidor na pista de corrida!', 'A competitor in the bug fighting ring!': 'Um competidor no ringue de luta!',
  // ── v2 online (painel, avisos e popups) ──
  'ONLINE': 'ONLINE', 'WORLD': 'MUNDO', 'OFFERS': 'OFERTAS', 'CHALLENGES': 'DESAFIOS', 'ACCOUNT': 'CONTA',
  'ACCEPT': 'ACEITAR', 'DECLINE': 'RECUSAR', 'COPY': 'COPIAR', 'PROFILE': 'PERFIL', 'REMOVE': 'REMOVER', 'SURE?': 'CERTEZA?',
  'WATCH': 'ASSISTIR', 'START': 'COMEÇAR', 'JOIN': 'ENTRAR', 'RECOVER': 'RECUPERAR', 'SIGN OUT': 'SAIR', 'SYNC NOW': 'SINCRONIZAR',
  'PLAY ONLINE': 'JOGAR ONLINE', 'SAVE NAME': 'SALVAR NOME', 'CREATE RECOVERY CODE': 'CRIAR CÓDIGO DE RECUPERAÇÃO',
  'CREATE WORLD': 'CRIAR MUNDO', 'LEAVE WORLD': 'SAIR DO MUNDO', 'END MULTIPLAYER': 'ENCERRAR MULTIPLAYER',
  'LINK THIS GAME': 'VINCULAR ESTE JOGO', 'LOAD CLOUD SAVE': 'CARREGAR DA NUVEM', 'USE THIS GAME': 'USAR ESTE JOGO',
  'OFFER TRADE': 'OFERECER TROCA', 'CHALLENGE: FIGHT': 'DESAFIAR: LUTA', 'CHALLENGE: RACE': 'DESAFIAR: CORRIDA',
  'SEND OFFER': 'ENVIAR OFERTA', 'SEND CHALLENGE': 'ENVIAR DESAFIO', 'FIGHT': 'LUTA', 'RACE': 'CORRIDA',
  'Play online': 'Jogar online', 'Your name': 'Seu nome', 'Already played online?': 'Já jogou online?', 'Recovery code': 'Código de recuperação',
  "Enter your name to play with friends: create a world and share its code, or join a friend's world.":
    'Digite seu nome para jogar com amigos: crie um mundo e compartilhe o código, ou entre no mundo de um amigo.',
  'Use your recovery code to get your player back on this device.': 'Use seu código de recuperação para trazer seu jogador para este aparelho.',
  'Playing offline still works: the online mode only adds friends, trades and challenges.':
    'Jogar offline continua igual: o online só acrescenta amigos, trocas e desafios.',
  'Your player': 'Seu jogador', 'Cloud save': 'Save na nuvem', 'Copied!': 'Copiado!', 'Saved!': 'Salvo!', 'Linked!': 'Vinculado!',
  'Select the text and copy it.': 'Selecione o texto e copie.',
  'Keep this code: it brings your player back if you clear the browser, and lets you play on another device.':
    'Guarde este código: ele traz seu jogador de volta se você limpar o navegador e permite jogar em outro aparelho.',
  'The recovery code is not stored on this device.': 'O código de recuperação não está guardado neste aparelho.',
  'This game is linked to your player (cloud save).': 'Este jogo está vinculado ao seu jogador (save na nuvem).',
  'Link this game to your player?': 'Vincular este jogo ao seu jogador?', 'Link this game to your player first.': 'Vincule este jogo ao seu jogador primeiro.',
  'Your player already has a cloud save:': 'Seu jogador já tem um save na nuvem:',
  'Your local game is always kept on this device, online or not.': 'Seu jogo local sempre fica neste aparelho, com ou sem online.',
  'Without the recovery code this player is lost. Click again to sign out.': 'Sem o código de recuperação este jogador se perde. Clique de novo para sair.',
  'Name: 2 to 16 characters.': 'Nome: de 2 a 16 caracteres.',
  'World': 'Mundo', 'World code': 'Código do mundo', 'World code:': 'Código do mundo:', 'players': 'jogadores',
  'Create a world': 'Criar um mundo', 'Join a world': 'Entrar num mundo', 'Welcome to the world!': 'Bem-vindo ao mundo!',
  '(owner)': '(dono)', '(you)': '(você)', '(no game linked)': '(sem jogo vinculado)', '(former member)': '(ex-membro)', 'in the shop now': 'na loja agora',
  'Click again to remove this player from the world.': 'Clique de novo para tirar este jogador do mundo.',
  'Click again to leave the world.': 'Clique de novo para sair do mundo.',
  'Everyone leaves the world (local games are kept). Click again to end it.': 'Todos saem do mundo (os jogos locais continuam). Clique de novo para encerrar.',
  'Pyramid': 'Pirâmide', 'Bug collection': 'Insetário', 'Fights and races': 'Lutas e corridas', 'No fights or races yet.': 'Nenhuma luta ou corrida ainda.',
  'vs': 'vs', 'won': 'venceu', 'lost': 'perdeu', 'Bet': 'Aposta', 'Bet: $': 'Aposta: $', 'ATK': 'ATQ', 'HP': 'HP', 'SPD': 'VEL', 'bugs': 'insetos',
  'Trade with': 'Trocar com', 'You give': 'Você dá', 'You want': 'Você quer', '+ money: $': '+ dinheiro: $',
  'Money you give': 'Dinheiro que você dá', 'Money you want': 'Dinheiro que você quer', 'Pick at least one bug.': 'Escolha pelo menos um inseto.',
  'Offer sent!': 'Oferta enviada!', 'Offers received': 'Ofertas recebidas', 'Offers sent': 'Ofertas enviadas', 'History': 'Histórico', 'None.': 'Nada.',
  'gives:': 'dá:', 'wants:': 'quer:', 'to': 'para', 'you give': 'você dá', 'you get': 'você recebe',
  'pending': 'pendente', 'accepted': 'aceita', 'declined': 'recusada', 'cancelled': 'cancelada',
  'You no longer have that bug.': 'Você não tem mais esse inseto.',
  'Fight against': 'Luta contra', 'Race against': 'Corrida contra', '(the winner takes both bets)': '(o vencedor leva as duas apostas)',
  'Pick 1 to 3 bugs. Your friend picks the same number.': 'Escolha de 1 a 3 insetos. Seu amigo escolhe o mesmo número.',
  'Pick 1 or 2 bugs. Your friend picks the same number.': 'Escolha 1 ou 2 insetos. Seu amigo escolhe o mesmo número.',
  'Challenge sent!': 'Desafio enviado!', 'Challenges received': 'Desafios recebidos', 'Waiting for your friend': 'Esperando seu amigo',
  'In progress': 'Em andamento', 'Results': 'Resultados', 'Their team': 'Time adversário', 'Your team': 'Seu time',
  'Trade completed!': 'Troca concluída!', 'Your offer was declined.': 'Sua oferta foi recusada.', 'Your challenge was declined.': 'Seu desafio foi recusado.',
  'You lost a challenge.': 'Você perdeu um desafio.', 'A player joined your world!': 'Um jogador entrou no seu mundo!',
  'You were removed from the world.': 'Você foi removido do mundo.', 'The world was ended by its owner.': 'O dono encerrou o mundo.',
  'New trade offer!': 'Nova oferta de troca!', 'New challenge!': 'Novo desafio!', 'Load newer cloud save?': 'Carregar save da nuvem?',
  'Tank full: the bug went to your sell list!': 'Tanque cheio: o inseto foi para a lista de venda!', 'Friend :': 'Amigo :',
  // ── v2: telas do multiplayer (HUD, Mundo, Amigos, PvP, Troca, conta nas Configurações) ──
  'FRIENDS': 'AMIGOS', 'TRADE': 'TROCA', 'ENABLE MULTIPLAYER': 'ATIVAR MULTIPLAYER', 'OPEN SETTINGS': 'ABRIR CONFIGURAÇÕES',
  'CHALLENGE A FRIEND': 'DESAFIAR UM AMIGO', 'HISTORY': 'HISTÓRICO', 'FOR SALE': 'À VENDA', 'TRADE WITH A FRIEND': 'TROCAR COM UM AMIGO',
  'ONLINE ACCOUNT': 'CONTA ONLINE', 'Name:': 'Nome:', 'Recovery code:': 'Código de recuperação:',
  'Enable multiplayer': 'Ativar o multiplayer', 'Name': 'Nome', 'Money': 'Dinheiro', 'Time': 'Tempo', 'online': 'conectado', 'offline': 'desconectado',
  'You need an online player to use multiplayer.': 'Você precisa de um jogador online para usar o multiplayer.',
  'Create it in the game settings (ONLINE ACCOUNT): only your name is needed.': 'Crie nas configurações do jogo (CONTA ONLINE): só precisa do seu nome.',
  'You are not in a world yet.': 'Você ainda não está num mundo.',
  'Open the multiplayer setup to create or join a world.': 'Abra a configuração do multiplayer para criar ou entrar num mundo.',
  'No challenges.': 'Nenhum desafio.', 'No friends in your world yet.': 'Ainda não há amigos no seu mundo.',
  'No bugs for sale in your world.': 'Nenhum inseto à venda no seu mundo.', 'No offers.': 'Nenhuma oferta.',
  'This game is not linked to your player yet: see the game settings (ONLINE ACCOUNT).': 'Este jogo ainda não está vinculado ao seu jogador: veja as configurações do jogo (CONTA ONLINE).',
  'Cloud save: on': 'Save na nuvem: ligado', 'Cloud save:': 'Save na nuvem:', 'Purchase request sent!': 'Pedido de compra enviado!',
  'End the multiplayer for everyone ?': 'Encerrar o multiplayer para todos ?', 'Leave the world ?': 'Sair do mundo ?',
  'Sign out ?\nKeep your recovery code!': 'Sair ?\nGuarde seu código de recuperação!',
  'Friends :': 'Amigos :', 'See who is online and open their profile!': 'Veja quem está online e abra o perfil!',
  'Multiplayer setup :': 'Configuração do multiplayer :', 'Create or join a world and share its code!': 'Crie ou entre num mundo e compartilhe o código!',
  'PvP :': 'PvP :', 'Challenge your friends to fights and races,': 'Desafie seus amigos para lutas e corridas,',
  'accept challenges and watch the replays!': 'aceite desafios e assista aos replays!',
  'Multiplayer trading :': 'Troca multiplayer :', "Buy bugs from your friends' sell lists": 'Compre insetos da lista de venda dos amigos',
  'and trade bugs and money with them!': 'e troque insetos e dinheiro com eles!',
  // erros do servidor (RPCs) e do Auth
  'world not found': 'Mundo não encontrado.', 'world is full': 'O mundo está cheio (10 jogadores).', 'already in a world': 'Você já está num mundo.',
  'the owner ends the world instead': 'O dono não sai: ele encerra o mundo.', 'not allowed': 'Não permitido.', 'member not found': 'Jogador não encontrado.',
  'offer not found': 'Oferta não encontrada.', 'challenge not found': 'Desafio não encontrado.', 'not friends': 'Esse jogador não está no seu mundo.',
  'too many pending offers': 'Ofertas pendentes demais.', 'too many pending challenges': 'Desafios pendentes demais.',
  'invalid team': 'Time inválido.', 'invalid bug': 'Inseto inválido.', 'Invalid recovery code.': 'Código de recuperação inválido.',
  'Invalid login credentials': 'Código de recuperação não encontrado.', 'Request rate limit reached': 'Muitas tentativas. Tente de novo mais tarde.', 'Captcha failed.': 'Falha no captcha.', 'Failed to fetch': 'Sem conexão.',
};

const dec = (n: string) => n.replace('.', ','); // número decimal à brasileira
const nm = (n: string) => n.replace(/^Bug (\d+)$/, 'Inseto $1'); // nome padrão dos insetos
const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^CONTINUE AS (.+)$/, (_, n) => `CONTINUAR COMO ${n}`],
  [/^DELETE (.+) \?$/, (_, n) => `EXCLUIR ${n} ?`],
  [/^SPEED (\S+)$/, (_, n) => `VEL. ${n}`],
  [/^RACE SPEED (\S+)$/, (_, n) => `ACELERAR ${n}`],
  [/^LANGUAGE: (.+)$/, (_, n) => `IDIOMA: ${n}`],
  [/^SYNC BUGS SPEED: (ON|OFF)$/, (_, n) => `SINCRONIZAR VELOCIDADE: ${n == 'ON' ? 'SIM' : 'NÃO'}`],
  [/^Bug (\d+)$/, (_, n) => `Inseto ${n}`],
  [/^([\d.]+) Days$/, (_, n) => `${dec(n)} Dias`],
  [/^([\d.]+) days$/, (_, n) => `${dec(n)} dias`],
  [/^Happiness \+(.+)$/, (_, n) => `Felicidade +${n}`],
  [/^((?:(?:Hunger|Happiness|Health|Growth)[+-][\d.]+\.?\s*)+)$/, (_, s) =>
    s.replace(/Hunger/g, 'Fome').replace(/Happiness/g, 'Felicidade').replace(/Health/g, 'Saúde').replace(/Growth/g, 'Crescimento')],
  [/^You sold (.+) for \$ (\S+) ?!$/, (_, n, v) => `Você vendeu ${nm(n)} por $ ${v}!`],
  [/^You put (.+) on the sell list!$/, (_, n) => `Você colocou ${nm(n)} na lista de venda!`],
  [/^You bought a bug with \$ (.+)!$/, (_, v) => `Você comprou um inseto por $ ${v}!`],
  [/^You bought some food with \$ (.+)!$/, (_, v) => `Você comprou comida por $ ${v}!`],
  [/^You bought a toy with \$ (.+)!$/, (_, v) => `Você comprou um brinquedo por $ ${v}!`],
  [/^Female bug can only breed again in (.+) days!$/, (_, n) => `A fêmea só poderá cruzar de novo em ${dec(n)} dias!`],
  [/^You lose!\nYou lost \$ (.+)!$/, (_, v) => `Você perdeu!\nVocê perdeu $ ${v}!`],
  [/^You win!\nYou got \$ (.+)!$/, (_, v) => `Você ganhou!\nVocê recebeu $ ${v}!`],
  [/^You have (\d+) bugs in your tank!$/, (_, n) => `Você tem ${n} insetos no seu tanque!`],
  [/^You are currently selling (\d+) bugs!$/, (_, n) => `Você está vendendo ${n} insetos!`],
  // v2 online
  [/^(\d+) days$/, (_, n) => `${n} dias`],
  [/^Pick exactly (\d+) bugs\.$/, (_, n) => `Escolha exatamente ${n} insetos.`],
  [/^Pick up to (\d+) bugs\.$/, (_, n) => `Escolha até ${n} insetos.`],
  [/^Create a world and share its code with up to (\d+) friends\.$/, (_, n) => `Crie um mundo e compartilhe o código com até ${n} amigos.`],
  [/^You won a challenge! \+\$ (\d+)$/, (_, n) => `Você venceu um desafio! +$ ${n}`],
  [/^([A-Z][A-Z ]+) \((\d+)\)$/, (_, a, n) => `${trPlain(a) ?? a} (${n})`], // abas com contagem: "OFFERS (2)"
  [/^Remove (.+) \?$/, (_, n) => `Remover ${n} ?`],
  [/^Official winner: (.+)$/, (_, n) => `Vencedor oficial: ${n}`],
  [/^(.+) wins!$/, (_, n) => `${n} venceu!`],
];

/** texto simples (sem tags): exato > padrão, preservando os espaços das pontas */
function trPlain(s: string): string | undefined {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  const core = m[2];
  if (!core) return undefined;
  let t = EXACT[core];
  if (t === undefined) for (const [re, f] of PATTERNS) { const r = re.exec(core); if (r) { t = f(...r); break; } }
  return t === undefined ? undefined : m[1] + t + m[3];
}

const seen = new Set<string>(); // só para depuração: textos sem tradução vistos no modo PT
export function tr(src: string, html: boolean): string {
  let out = trPlain(src);
  if (out === undefined && html && src.includes('<')) {
    // HTML: traduz só os trechos de texto entre as tags
    out = src.split(/(<[^>]*>)/).map((p, i) => i % 2 ? p : trPlain(p) ?? p).join('');
  }
  if (out === undefined) {
    if (import.meta.env.DEV && /[A-Za-z]{2}/.test(src.replace(/<[^>]*>/g, '')) && !seen.has(src)) {
      seen.add(src);
      ((window as any).__i18nMiss ??= []).push(src);
    }
    return src;
  }
  return out;
}

// ───────────────── textos estáticos (DefineText), por id ─────────────────
// Cada item = linhas; o motor mantém posição/cor/tamanho originais (ver drawStaticAlt).
const STATIC: Record<number, string[]> = {
  73: ['INVENTÁRIO'], 77: ['RENOMEAR'], 82: ['LUTA'], 83: ['CORRIDA'],
  401: ['Inseto Supremo!'], 402: ['Ah, não!', 'O que você', 'fez?!'],
  281: ['Seu objetivo é criar o ', 'inseto supremo!', 'Para começar, alimente e ', 'limpe a sujeira dos seus ', 'insetos ou eles morrerão!'],
  283: ['Comida e droga mantêm ', 'seus insetos vivos e ', 'felizes! Cada tipo de ', 'comida tem valores de ', 'energia diferentes!'],
  285: ['A droga acelera o ', 'crescimento, mas pode ', 'fazer mal à saúde!'],
  286: ['Aponte, clique e arraste ', 'para mover os insetos e ', 'colocá-los na comida! ', 'Passe o mouse sobre algo ', 'para ver suas ', 'estatísticas vitais!'],
  288: ['Cruze seus insetos aqui ', 'e crie novas espécies.'],
  290: ['Você pode vender seus ', 'insetos aqui!'],
  292: ['Você pode renomear ', 'seus insetos!'],
  294: ['O triângulo evolutivo: ', 'tente cruzar insetos e ', 'criar o inseto ', 'supremo!'],
  296: ['Compre novos insetos, ', 'comida ou brinquedos no ', 'mercado! Os itens podem ', 'ser comprados do ', 'vendedor da loja ou de ', 'vendedores particulares!'],
  298: ['Arena de lutas e corridas ', 'para apostar dinheiro ', 'nos seus insetos.'],
  338: ['Seu objetivo neste jogo é criar e cruzar besouros para gerar o ',
    'besouro supremo. Você precisa cuidar desses insetos: alimentá-los, ',
    'entretê-los e limpar a sujeira deles. Não é tão fácil assim.',
    'Venda insetos, compre insetos, evolua insetos, faça corridas e lutas. ',
    'Este jogo vai te manter ocupado por muito tempo.',
    'Consegue manter seus insetos vivos e vencer no mundo dos insetos? ',
    'Obs.: o jogo salva sozinho!'],
};
let idOf: Map<any, number> | null = null;
function staticId(def: any): number | undefined {
  if (!idOf) {
    idOf = new Map();
    for (const [id, c] of Object.entries<any>(player().data.chars)) if (c.type === 'text') idOf.set(c, +id);
  }
  return idOf.get(def);
}

export function installI18n() {
  setTextHook({
    field: (src, html) => (lang === 'pt' ? tr(src, html) : src),
    staticText: def => (lang === 'pt' ? STATIC[staticId(def)!] ?? null : null),
  });
}
