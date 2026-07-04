import type { ListType } from '../types'

export interface ListCategory {
  id: string
  name: string
  emoji: string
  color: string
  keywords: string[]
}

export const LIST_CATEGORIES: Record<ListType, ListCategory[]> = {
  shopping: [
    { id: 'produce',   name: 'Produce', emoji: '🍎',       color: '#1D9E75',
      keywords: ['apple','banana','orange','grape','mango','papaya','lemon','lime','tomato','onion','potato','garlic','ginger','carrot','spinach','cabbage','capsicum','brinjal','eggplant','cauliflower','cucumber','peas','beans','corn','chilli','coriander','mint','curry leaves','fruit','fruits','vegetable','vegetables','veggies','greens'] },
    { id: 'dairy',     name: 'Dairy', emoji: '🥛',         color: '#06B6D4',
      keywords: ['milk','cheese','butter','yogurt','curd','dahi','paneer','cream','ghee','eggs','egg'] },
    { id: 'meat',      name: 'Meat & Fish', emoji: '🍗',   color: '#EF4444',
      keywords: ['chicken','fish','mutton','prawn','prawns','beef','pork','lamb','meat','seafood'] },
    { id: 'pantry',    name: 'Pantry', emoji: '🌾',        color: '#A855F7',
      keywords: ['rice','wheat','flour','atta','bread','loaf','bun','roll','pav','roti','chapati','oil','sugar','salt','oats','pasta','noodle','noodles','dal','moong','chana','rajma','chickpea','lentil','semolina','poha','jam','honey','spice','turmeric','cumin','masala','sauce','vinegar','idli','dosa','rava','suji','besan'] },
    { id: 'frozen',    name: 'Frozen', emoji: '❄️',        color: '#3B82F6',
      keywords: ['frozen','ice cream','icecream','popsicle'] },
    { id: 'beverages', name: 'Beverages', emoji: '🥤',     color: '#F59E0B',
      keywords: ['juice','soda','cola','pepsi','coke','water','beer','wine','tea','coffee','drink','beverage','smoothie','shake'] },
    { id: 'snacks',    name: 'Snacks', emoji: '🍿',        color: '#EC4899',
      keywords: ['chips','biscuit','biscuits','cookie','cookies','chocolate','candy','popcorn','namkeen','snack','snacks','wafer','crackers'] },
    { id: 'household', name: 'Household', emoji: '🧻',     color: '#6B7280',
      keywords: ['detergent','dish soap','cleaner','tissue','tissues','garbage bag','toilet paper','phenyl','disinfectant','broom','mop','sponge'] },
    { id: 'personal',  name: 'Personal Care', emoji: '🧴', color: '#EAB308',
      keywords: ['shampoo','toothpaste','toothbrush','soap','razor','deodorant','lotion','face wash','moisturizer','sunscreen','perfume','shower gel'] },
  ],
  tasks: [
    { id: 'work',     name: 'Work', emoji: '💼',     color: '#3B82F6',
      keywords: ['meeting','email','report','review','call','project','presentation','deadline','client','standup','sync','interview','sprint'] },
    { id: 'home',     name: 'Home', emoji: '🏠',     color: '#1D9E75',
      keywords: ['clean','cook','wash','laundry','fix','repair','install','tidy','dishes','vacuum','iron','dust','plumber','electrician'] },
    { id: 'errands',  name: 'Errands', emoji: '🛵',  color: '#F59E0B',
      keywords: ['pickup','pick up','drop','buy','visit','pay','bill','bank','grocery','post office','courier','atm','renewal'] },
    { id: 'health',   name: 'Health', emoji: '❤️',   color: '#EF4444',
      keywords: ['doctor','dentist','medicine','medicines','gym','workout','exercise','appointment','clinic','test','scan','vaccine','therapy','yoga'] },
    { id: 'finance',  name: 'Finance', emoji: '💰',  color: '#A855F7',
      keywords: ['invest','tax','bill','payment','subscription','budget','emi','loan','sip','insurance','premium'] },
    { id: 'social',   name: 'Social', emoji: '🎉',   color: '#EC4899',
      keywords: ['birthday','party','gift','dinner','meet','catch up','catchup','wedding','anniversary','reunion'] },
    { id: 'learning', name: 'Learning', emoji: '📚', color: '#06B6D4',
      keywords: ['study','read','course','tutorial','watch','practice','book','chapter','learn','udemy','coursera'] },
  ],
  personal: [
    { id: 'ideas',   name: 'Ideas', emoji: '💡',   color: '#F59E0B',
      keywords: ['idea','brainstorm','concept','plan','prototype','sketch'] },
    { id: 'notes',   name: 'Notes', emoji: '📝',   color: '#3B82F6',
      keywords: ['note','reminder','memo','log','journal'] },
    { id: 'wishes',  name: 'Wishes', emoji: '⭐',  color: '#EC4899',
      keywords: ['wish','want','dream','buy someday','wishlist','someday'] },
    { id: 'travel',  name: 'Travel', emoji: '✈️',  color: '#06B6D4',
      keywords: ['trip','flight','hotel','visit','vacation','holiday','airport','booking','itinerary'] },
    { id: 'general', name: 'General', emoji: '📌', color: '#6B7280',
      keywords: [] },
  ],
}

// Keyword match against a caller-supplied category list (user-customized
// categories come from useCategoriesStore, not the static defaults).
export function detectCategoryIn(cats: ListCategory[], text: string): string | null {
  const lower = text.toLowerCase().trim()
  if (!lower) return null
  for (const cat of cats) {
    for (const k of cat.keywords) {
      if (lower.includes(k.toLowerCase())) return cat.id
    }
  }
  return null
}

export function detectCategory(text: string, type: ListType): string | null {
  return detectCategoryIn(LIST_CATEGORIES[type], text)
}

export function getCategoryMeta(type: ListType, catId: string | null): ListCategory | null {
  if (!catId) return null
  return LIST_CATEGORIES[type].find(c => c.id === catId) ?? null
}

export function parseItemInput(raw: string): { item: string; qty: string } {
  // Explicit count: "Milk x2" / "Milk ×2" → "×N". The × symbol may sit against
  // the word, but a bare ASCII "x" must be its own token so "Xbox 2" is safe.
  const crossM = raw.match(/(?:×|(?:^|\s)x)\s*(\d+(?:\.\d+)?)\s*$/i)
  if (crossM) {
    const item = raw.slice(0, raw.length - crossM[0].length).trim()
    if (item) return { item, qty: `×${crossM[1]}` }
  }
  // Number + unit, e.g. "Rice 2kg" / "Rice 2 kg" / "Milk 1.5L". Multi-char
  // units (kg, mg, ml) come before "g" so they win at the same position.
  const unitM = raw.match(/\s+(\d+(?:\.\d+)?)\s*(kg|mg|g|litres?|l|ml|lbs?|oz|pcs?|pieces?|packs?|box(?:es)?|units?|doz(?:en)?)\s*$/i)
  if (unitM) {
    const item = raw.slice(0, raw.length - unitM[0].length).trim()
    // Preserve the unit's casing (2L stays 2L) but drop the inner space.
    if (item) return { item, qty: `${unitM[1]}${unitM[2]}` }
  }
  // Bare trailing number, e.g. "Apple 3" / "Eggs 12" → ×N (spec §2.3–2.4).
  // We only treat it as a count, never invent a unit the user didn't type.
  const bareM = raw.match(/\s+(\d+(?:\.\d+)?)\s*$/)
  if (bareM) {
    const item = raw.slice(0, raw.length - bareM[0].length).trim()
    if (item) return { item, qty: `×${bareM[1]}` }
  }
  return { item: raw.trim(), qty: '' }
}

export const GROCERY_VOCAB = [
  'Milk', 'Eggs', 'Bread', 'Butter', 'Cheese', 'Yogurt', 'Cream',
  'Rice', 'Wheat flour', 'Oats', 'Pasta', 'Noodles', 'Poha', 'Semolina',
  'Tomatoes', 'Onions', 'Potatoes', 'Garlic', 'Ginger', 'Carrots', 'Spinach',
  'Cabbage', 'Capsicum', 'Brinjal', 'Cauliflower', 'Cucumber', 'Peas',
  'Apples', 'Bananas', 'Oranges', 'Grapes', 'Mangoes', 'Papaya',
  'Chicken', 'Fish', 'Mutton', 'Prawns', 'Paneer',
  'Cooking oil', 'Ghee', 'Sugar', 'Salt', 'Turmeric', 'Cumin', 'Coriander',
  'Red chilli powder', 'Garam masala', 'Mustard seeds', 'Curry leaves',
  'Dal', 'Moong dal', 'Chana dal', 'Rajma', 'Chickpeas',
  'Tea', 'Coffee', 'Biscuits', 'Chips', 'Honey', 'Jam',
  'Detergent', 'Dish soap', 'Shampoo', 'Toothpaste', 'Soap',
  'Toilet paper', 'Tissues', 'Garbage bags',
]

export const TEMPLATES: { id: string; label: string; emoji: string; type: ListType; items: { title: string; category?: string }[] }[] = [
  { id: 'groceries', label: 'Monthly Groceries', emoji: '🛒', type: 'shopping', items: [
    { title: 'Rice',        category: 'pantry'  },
    { title: 'Milk',        category: 'dairy'   },
    { title: 'Eggs',        category: 'dairy'   },
    { title: 'Vegetables',  category: 'produce' },
    { title: 'Bread',       category: 'pantry'  },
    { title: 'Cooking oil', category: 'pantry'  },
  ]},
  { id: 'travel', label: 'Travel Checklist', emoji: '✈️', type: 'personal', items: [
    { title: 'Passport',         category: 'travel' },
    { title: 'Charger',          category: 'general' },
    { title: 'Hotel booking',    category: 'travel' },
    { title: 'Flight tickets',   category: 'travel' },
    { title: 'Travel insurance', category: 'travel' },
  ]},
  { id: 'office', label: 'Office Tasks', emoji: '💼', type: 'tasks', items: [
    { title: 'Team meeting',  category: 'work' },
    { title: 'Review PRs',    category: 'work' },
    { title: 'Submit report', category: 'work' },
    { title: 'Reply emails',  category: 'work' },
  ]},
  { id: 'home', label: 'Home Chores', emoji: '🏠', type: 'personal', items: [
    { title: 'Laundry',       category: 'general' },
    { title: 'Clean kitchen', category: 'general' },
    { title: 'Pay bills',     category: 'general' },
    { title: 'Vacuum floors', category: 'general' },
  ]},
]
