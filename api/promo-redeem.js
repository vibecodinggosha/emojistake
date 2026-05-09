const { Redis } = require('@upstash/redis');

const PROMO_CODES = {
  'ESGEM': { reward: 20000, maxUses: 15 }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const code = (req.body?.code || '').trim().toUpperCase();
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

  const promo = PROMO_CODES[code];
  if (!promo) {
    return res.status(200).json({ ok: false, error: 'Invalid promo code.' });
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const globalKey = `promo:global:${code}`;
  const ipKey = `promo:ip:${ip}:${code}`;

  // Check per-IP limit
  const ipUsed = await redis.get(ipKey);
  if (ipUsed) {
    return res.status(200).json({ ok: false, error: 'You already used this code.' });
  }

  // Atomically increment global counter and check limit
  const globalCount = await redis.incr(globalKey);
  if (globalCount > promo.maxUses) {
    await redis.decr(globalKey);
    return res.status(200).json({ ok: false, error: 'Promo code fully redeemed.' });
  }

  await redis.set(ipKey, 1);

  return res.status(200).json({
    ok: true,
    reward: promo.reward,
    remaining: promo.maxUses - globalCount
  });
};
