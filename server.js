const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'promo_data.json');

// Promo code definitions: maxUses = total global activations allowed
const PROMO_CODES = {
  'ESGEM': { reward: 20000, maxUses: 15 }
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {}
  return { globalUses: {}, ipUses: {} };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/promo/redeem', (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  const promo = PROMO_CODES[code];
  if (!promo) {
    return res.json({ ok: false, error: 'Invalid promo code.' });
  }

  const data = loadData();
  if (!data.globalUses[code]) data.globalUses[code] = 0;
  if (!data.ipUses[ip]) data.ipUses[ip] = {};
  if (!data.ipUses[ip][code]) data.ipUses[ip][code] = 0;

  if (data.globalUses[code] >= promo.maxUses) {
    return res.json({ ok: false, error: 'Promo code fully redeemed.' });
  }

  if (data.ipUses[ip][code] >= 1) {
    return res.json({ ok: false, error: 'You already used this code.' });
  }

  data.globalUses[code]++;
  data.ipUses[ip][code]++;
  saveData(data);

  const remaining = promo.maxUses - data.globalUses[code];
  return res.json({ ok: true, reward: promo.reward, remaining });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
