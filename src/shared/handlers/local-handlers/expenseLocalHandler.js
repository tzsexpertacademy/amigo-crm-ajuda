const QUESTION_WORDS_BLACKLIST = [
  'como',
  'quanto',
  'quantos',
  'qual',
  'quais',
  'quando',
  'onde',
  'aonde',
  'quem',
  'por que',
  'por quê',
  'para que',
  'pra que',
  'o que',
  'que',
  'cadê',
  'por qual motivo',
  'por qual razao',
  'por qual razão'
];

const BLACKLIST = [
  'fatura','vencimento','fechamento','parcela','faturamento','aluguel',
  ...QUESTION_WORDS_BLACKLIST
];

const PORTUGUESE_NUMBERS = [
  'zero','um','uma','dois','duas','tres','quatro','cinco','seis','sete','oito','nove',
  'dez','onze','doze','treze','quatorze','catorze','quinze','dezesseis','dezessete',
  'dezoito','dezenove','vinte','trinta','quarenta','cinquenta','sessenta','setenta',
  'oitenta','noventa','cem','cento','duzentos','trezentos','quatrocentos','quinhentos',
  'seiscentos','setecentos','oitocentos','novecentos','mil'
];

const DEFAULT_PAYMENT_METHODS = [
  'pix','picpay','debito','débito','credito','crédito','cartao','cartão',
  'dinheiro','boleto','cheque','transferencia','transferência','deposito',
  'depósito','paypal','mercadopago','ame','pagbank','applepay','googlepay'
];

function getPaymentMethods(extra = []) {
  return [...new Set(DEFAULT_PAYMENT_METHODS.concat(extra.map(m => m.toLowerCase())))];
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function isSpelledNumber(token) {
  return PORTUGUESE_NUMBERS.includes(normalize(token));
}

function isNumericValue(token) {
  const t = token
    .replace(/^r\$\s*/i, '')
    .replace(/reais$/i, '')
    .replace(',', '.')
    .trim();
  return /^[0-9]+(\.[0-9]+)?$/.test(t);
}

function isMoneyToken(token) {
  const n = normalize(token);
  const withoutReais = n.replace(/reais$/, '').trim();
  if (isSpelledNumber(withoutReais)) return true;
  
  if (isNumericValue(token)) {
    const raw = n
      .replace(/^r\$\s*/i, '')
      .replace(/reais$/, '')
      .replace(',', '.')
      .trim();
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      if (val >= 1900 && val <= 2100) {
        if (!(n.includes('r$') || n.includes('reais'))) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

function canProcessLocally(msg, extraPayments =[]) {
  return false
  if (!msg) return false;
  const text = normalize(msg);

  if (BLACKLIST.some(word => text.includes(word))) {
    return false;
  }

  const tokens = text.split(/\s+/).filter(Boolean);

  if (tokens.length < 2) return false;
  if (tokens.length > 6) return false;

  if (tokens.some(t => getPaymentMethods(extraPayments).includes(t))) {
    return false;
  }

  let moneyCount = 0;
  let moneyIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    if (isMoneyToken(tokens[i])) {
      moneyCount++;
      moneyIndex = i;
      if (moneyCount > 1) {
        return false;
      }
    }
  }

  if (moneyCount === 0) return false;

  const descriptiveTokens = tokens.filter((t, i) => {
    if (i === moneyIndex) return false;
    if (t === 'reais' || t === 'r$') return false;
    return true;
  });

  if (descriptiveTokens.length < 1) return false;

  return true;
}

module.exports = { canProcessLocally };
