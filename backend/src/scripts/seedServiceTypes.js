const pool = require('../db/pool');
const { normalize } = require('../utils/serviceTypes');

const TYPES = [
  ['Makeup', ['makeup', 'make-up', 'mua']],
  ['Nail fixing', ['nail']],
  ['Hair styling/braiding', ['hair', 'braid', 'braiding', 'weave']],
  ['Printing & photocopying', ['print', 'photocopy', 'photocopying']],
  ['Graphic design', ['graphic', 'flyer', 'poster', 'logo', 'invitation']],
  ['Website development', ['website', 'web dev', 'web development']],
  ['Photography', ['photography', 'photo shoot', 'photoshoot', 'photographer']],
  ['Haircuts/barbering', ['haircut', 'barber', 'barbering']],
  ['Errand running', ['errand']],
  ['Video recording/editing', ['video', 'videography', 'editing']],
  ['Custom T-shirts/hoodies', ['t-shirt', 'tshirt', 'hoodie', 'custom shirt', 'branding']],
  ['Mobile app development', ['app dev', 'mobile app', 'app development']],
  ['Pickup & delivery', ['pickup', 'delivery', 'courier']],
  ['Tutoring/lessons', ['tutor', 'tutoring', 'lessons', 'coaching', 'extra classes']],
  ['Laundry', ['laundry', 'washing', 'ironing']],
  ['Phone/laptop repair', ['repair', 'phone repair', 'laptop repair', 'screen fix']],
  ['Event planning/MC', ['event planning', 'mc', 'emcee', 'host', 'party planning']],
  ['Cleaning services', ['cleaning', 'cleaner', 'housekeeping']],
  ['Tailoring/sewing', ['tailor', 'tailoring', 'sewing', 'seamstress']],
];

(async () => {
  for (const [label, kws] of TYPES) {
    const r = await pool.query(
      `INSERT INTO service_types (label, normalized, status) VALUES ($1, $2, 'approved')
       ON CONFLICT (normalized) DO UPDATE SET status = 'approved' RETURNING id`,
      [label, normalize(label)]
    );
    const conds = kws.map((_, i) => `(p.title ILIKE $${i + 2} OR p.description ILIKE $${i + 2})`).join(' OR ');
    await pool.query(
      `UPDATE products p SET service_type_id = $1
       FROM categories c
       WHERE c.id = p.category_id AND c.name = 'Services'
         AND p.service_type_id IS NULL AND (${conds})`,
      [r.rows[0].id, ...kws.map((k) => `%${k}%`)]
    );
  }
  console.log('done');
  process.exit(0);
})();