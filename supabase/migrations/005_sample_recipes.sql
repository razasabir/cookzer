-- Seeds 10 sample recipes, attributed to razasabir@hotmail.com
-- (profiles.id = e4fbfbbc-40ea-4de4-b011-b5499b7906c7), so the site has
-- real, varied content to browse instead of an empty feed/cookbook.
-- Run in the Supabase SQL Editor after 003 and 004.

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Classic Spaghetti Carbonara',
  'The authentic Roman method: just eggs, Pecorino, guanciale, and black pepper, tossed off the heat into a silky sauce with no cream at all.',
  'Dinner',
  ARRAY[]::text[],
  10, 15, 4, null,
  $j$[{"name":"Spaghetti","qty":"400g"},{"name":"Guanciale or pancetta, diced","qty":"150g"},{"name":"Egg yolks","qty":"4"},{"name":"Whole egg","qty":"1"},{"name":"Pecorino Romano, grated","qty":"60g"},{"name":"Parmesan, grated","qty":"40g"},{"name":"Black pepper, freshly cracked","qty":"to taste"},{"name":"Salt, for pasta water","qty":"to taste"}]$j$::jsonb,
  $s$["Bring a large pot of salted water to a boil and cook the spaghetti until al dente.","While the pasta cooks, fry the guanciale in a cold pan over medium heat until crisp and golden, rendering the fat.","Whisk the egg yolks, whole egg, and half the cheese together in a bowl with plenty of black pepper.","Reserve a cup of pasta water, then drain the spaghetti and add it to the pan with the guanciale, off the heat.","Pour in the egg mixture, tossing constantly so residual heat cooks the eggs into a silky sauce without scrambling. Add a splash of pasta water if needed to loosen it.","Finish with the remaining cheese and extra black pepper, then serve immediately."]$s$::jsonb,
  $n${"calories":650,"protein":26,"carbs":72,"fat":28}$n$::jsonb,
  4.50
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Chicken Tikka Masala',
  'Charred, marinated chicken finished in a spiced, creamy tomato sauce, best served with rice or warm naan.',
  'Dinner',
  ARRAY['Halal'],
  90, 30, 4, 'Medium',
  $j$[{"name":"Chicken thighs, diced","qty":"800g"},{"name":"Plain yogurt","qty":"200g"},{"name":"Lemon juice","qty":"2 tbsp"},{"name":"Garam masala","qty":"2 tsp"},{"name":"Ground cumin","qty":"1 tsp"},{"name":"Ground turmeric","qty":"1 tsp"},{"name":"Garlic, crushed","qty":"4 cloves"},{"name":"Ginger, grated","qty":"2 tbsp"},{"name":"Onion, diced","qty":"1 large"},{"name":"Crushed tomatoes","qty":"400g"},{"name":"Double cream","qty":"150ml"},{"name":"Chili powder","qty":"1 tsp"},{"name":"Vegetable oil","qty":"2 tbsp"},{"name":"Salt","qty":"to taste"},{"name":"Fresh coriander, to finish","qty":"a handful"}]$j$::jsonb,
  $s$["Mix the yogurt, lemon juice, half the garlic and ginger, and half the spices in a bowl, add the chicken, and marinate for at least 1 hour (overnight is best).","Grill or pan-sear the marinated chicken until charred at the edges and just cooked through, then set aside.","In a separate pan, saute the onion in oil until soft, then add the remaining garlic, ginger, and spices and cook until fragrant.","Stir in the crushed tomatoes and simmer for 10-15 minutes until the sauce thickens and deepens in color.","Add the cream and grilled chicken, and simmer for another 5-10 minutes until warmed through and the sauce coats the chicken well.","Season to taste, scatter with fresh coriander, and serve with rice or naan."]$s$::jsonb,
  $n${"calories":420,"protein":35,"carbs":12,"fat":26}$n$::jsonb,
  5.00
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Fluffy Buttermilk Pancakes',
  'A classic weekend breakfast, light and fluffy thanks to buttermilk and a short rest before cooking.',
  'Breakfast',
  ARRAY['Vegetarian'],
  10, 15, 4, null,
  $j$[{"name":"Plain flour","qty":"250g"},{"name":"Baking powder","qty":"2 tsp"},{"name":"Baking soda","qty":"1/2 tsp"},{"name":"Sugar","qty":"2 tbsp"},{"name":"Salt","qty":"1/2 tsp"},{"name":"Buttermilk","qty":"480ml"},{"name":"Eggs","qty":"2"},{"name":"Butter, melted","qty":"3 tbsp"}]$j$::jsonb,
  $s$["Whisk the flour, baking powder, baking soda, sugar, and salt together in a large bowl.","In a separate bowl, whisk the buttermilk, eggs, and melted butter together.","Pour the wet ingredients into the dry and stir just until combined; a few lumps are fine.","Let the batter rest for 5 minutes while a lightly greased griddle or pan heats over medium heat.","Pour a quarter cup of batter per pancake and cook until bubbles form on the surface, then flip and cook until golden.","Serve warm with butter and maple syrup."]$s$::jsonb,
  $n${"calories":270,"protein":9,"carbs":40,"fat":8}$n$::jsonb,
  1.20
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Avocado Toast with Poached Egg',
  'A cafe-style breakfast: creamy mashed avocado on toasted sourdough, topped with a runny poached egg.',
  'Breakfast',
  ARRAY['Vegetarian'],
  10, 5, 2, null,
  $j$[{"name":"Sourdough bread, thick slices","qty":"2"},{"name":"Ripe avocado","qty":"1"},{"name":"Eggs","qty":"2"},{"name":"White vinegar","qty":"1 tbsp"},{"name":"Lemon juice","qty":"1 tsp"},{"name":"Chili flakes","qty":"a pinch"},{"name":"Salt and pepper","qty":"to taste"},{"name":"Extra virgin olive oil","qty":"to drizzle"}]$j$::jsonb,
  $s$["Toast the sourdough slices until golden and crisp.","Mash the avocado with lemon juice, salt, and pepper, then spread generously over the toast.","Bring a pot of water to a gentle simmer, add the vinegar, and swirl to create a whirlpool.","Crack each egg into the center and poach for 2-3 minutes until the white is set but the yolk is still runny.","Lift the eggs out with a slotted spoon, drain briefly, and place one on each slice of avocado toast.","Finish with a drizzle of olive oil, chili flakes, and a final pinch of salt."]$s$::jsonb,
  $n${"calories":320,"protein":13,"carbs":28,"fat":18}$n$::jsonb,
  2.50
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Chickpea and Spinach Curry',
  'A quick, fully plant-based curry built on coconut milk, warming spices, and fresh spinach stirred in at the end.',
  'Dinner',
  ARRAY['Vegan','Gluten-free'],
  10, 25, 4, 'Medium',
  $j$[{"name":"Chickpeas, drained","qty":"2 x 400g cans"},{"name":"Fresh spinach","qty":"200g"},{"name":"Onion, diced","qty":"1"},{"name":"Garlic, crushed","qty":"3 cloves"},{"name":"Ginger, grated","qty":"1 tbsp"},{"name":"Ground cumin","qty":"1 tsp"},{"name":"Ground coriander","qty":"1 tsp"},{"name":"Turmeric","qty":"1/2 tsp"},{"name":"Chili powder","qty":"1/2 tsp"},{"name":"Coconut milk","qty":"400ml"},{"name":"Crushed tomatoes","qty":"200g"},{"name":"Vegetable oil","qty":"2 tbsp"},{"name":"Salt","qty":"to taste"}]$j$::jsonb,
  $s$["Heat the oil in a large pan and saute the onion until softened and lightly golden.","Add the garlic, ginger, and spices, and cook for a minute until fragrant.","Stir in the crushed tomatoes and simmer for 5 minutes until slightly reduced.","Add the chickpeas and coconut milk, and simmer for 15 minutes until the sauce thickens.","Stir in the spinach and cook until just wilted, about 2-3 minutes.","Season to taste and serve with rice or flatbread."]$s$::jsonb,
  $n${"calories":340,"protein":12,"carbs":34,"fat":18}$n$::jsonb,
  1.80
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Greek Salad',
  'A simple, no-cook salad of crisp vegetables, briny olives, and a whole block of feta, dressed with olive oil and oregano.',
  'Lunch',
  ARRAY['Vegetarian','Gluten-free'],
  15, 0, 4, null,
  $j$[{"name":"Cucumber, chopped","qty":"1"},{"name":"Tomatoes, chopped","qty":"4"},{"name":"Red onion, thinly sliced","qty":"1/2"},{"name":"Green bell pepper, chopped","qty":"1"},{"name":"Kalamata olives","qty":"100g"},{"name":"Feta cheese, block","qty":"200g"},{"name":"Extra virgin olive oil","qty":"4 tbsp"},{"name":"Red wine vinegar","qty":"1 tbsp"},{"name":"Dried oregano","qty":"1 tsp"},{"name":"Salt and pepper","qty":"to taste"}]$j$::jsonb,
  $s$["Combine the cucumber, tomatoes, red onion, and bell pepper in a large bowl.","Scatter the olives over the vegetables.","Whisk the olive oil, vinegar, oregano, salt, and pepper together and pour over the salad.","Toss gently to coat everything in the dressing.","Place the block of feta on top (traditionally left whole rather than crumbled) and finish with a drizzle of olive oil and a sprinkle of oregano."]$s$::jsonb,
  $n${"calories":310,"protein":9,"carbs":12,"fat":26}$n$::jsonb,
  2.20
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Classic Beef Burgers',
  'Simply seasoned beef patties, grilled hot and fast, built into a classic cheeseburger.',
  'BBQ',
  ARRAY[]::text[],
  15, 10, 4, null,
  $j$[{"name":"Ground beef (80/20)","qty":"700g"},{"name":"Salt","qty":"1 tsp"},{"name":"Black pepper","qty":"1/2 tsp"},{"name":"Garlic powder","qty":"1/2 tsp"},{"name":"Burger buns","qty":"4"},{"name":"Cheddar cheese slices","qty":"4"},{"name":"Lettuce leaves","qty":"4"},{"name":"Tomato, sliced","qty":"1"},{"name":"Red onion, sliced","qty":"1/2"},{"name":"Burger sauce or mayo","qty":"to taste"}]$j$::jsonb,
  $s$["Divide the ground beef into 4 equal portions and shape into patties slightly wider than the buns, pressing a small dimple into the center of each.","Season both sides generously with salt, pepper, and garlic powder.","Preheat the grill or a cast-iron pan to high heat.","Cook the patties for 3-4 minutes per side for medium, adding a slice of cheese in the last minute to melt.","Toast the buns cut-side down on the grill for 30 seconds until lightly charred.","Build the burgers with sauce, lettuce, patty, tomato, and onion, then serve immediately."]$s$::jsonb,
  $n${"calories":560,"protein":34,"carbs":28,"fat":34}$n$::jsonb,
  3.50
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Margherita Pizza',
  'The original pizza: a thin, blistered crust with tomato, fresh mozzarella, and basil.',
  'Dinner',
  ARRAY['Vegetarian'],
  20, 12, 4, null,
  $j$[{"name":"Pizza dough","qty":"500g"},{"name":"Crushed tomatoes","qty":"200g"},{"name":"Garlic, crushed","qty":"1 clove"},{"name":"Fresh mozzarella, torn","qty":"200g"},{"name":"Fresh basil leaves","qty":"a handful"},{"name":"Extra virgin olive oil","qty":"2 tbsp"},{"name":"Salt","qty":"to taste"}]$j$::jsonb,
  $s$["Preheat the oven as high as it will go, ideally 250C/480F, with a pizza stone or upturned tray inside.","Divide the dough into 4 portions and stretch each into a thin round on a floured surface.","Mix the crushed tomatoes with the garlic and a pinch of salt, then spread a thin layer over each base.","Scatter torn mozzarella over the top and drizzle with a little olive oil.","Slide the pizza onto the hot stone or tray and bake for 8-12 minutes until the crust is blistered and golden.","Finish with fresh basil leaves and a final drizzle of olive oil before serving."]$s$::jsonb,
  $n${"calories":380,"protein":16,"carbs":48,"fat":14}$n$::jsonb,
  1.90
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Chocolate Chip Cookies',
  'Soft-centered, golden-edged cookies loaded with chocolate chips.',
  'Baking',
  ARRAY['Vegetarian'],
  15, 12, 12, null,
  $j$[{"name":"Butter, softened","qty":"225g"},{"name":"Brown sugar","qty":"150g"},{"name":"White sugar","qty":"100g"},{"name":"Eggs","qty":"2"},{"name":"Vanilla extract","qty":"1 tsp"},{"name":"Plain flour","qty":"350g"},{"name":"Baking soda","qty":"1 tsp"},{"name":"Salt","qty":"1/2 tsp"},{"name":"Chocolate chips","qty":"300g"}]$j$::jsonb,
  $s$["Preheat the oven to 180C (350F) and line baking trays with parchment paper.","Cream the butter with both sugars until light and fluffy.","Beat in the eggs one at a time, then stir in the vanilla extract.","Whisk the flour, baking soda, and salt together, then fold into the wet mixture until just combined.","Fold in the chocolate chips.","Drop tablespoon-sized balls of dough onto the trays, spaced well apart, and bake for 10-12 minutes until golden at the edges but still soft in the center.","Cool on the tray for 5 minutes before transferring to a wire rack."]$s$::jsonb,
  $n${"calories":260,"protein":3,"carbs":34,"fat":13}$n$::jsonb,
  0.60
);

insert into public.recipes (author_id, title, description, category, dietary_tags, prep_time_minutes, cook_time_minutes, servings, spice_level, ingredients, steps, nutrition, cost_per_serve)
values (
  'e4fbfbbc-40ea-4de4-b011-b5499b7906c7',
  'Loaded Nachos',
  'Crisp tortilla chips baked under melted cheese and black beans, finished with fresh toppings.',
  'Appetizers',
  ARRAY['Vegetarian','Gluten-free'],
  10, 15, 4, 'Medium',
  $j$[{"name":"Tortilla chips","qty":"250g"},{"name":"Black beans, drained","qty":"400g"},{"name":"Cheddar cheese, grated","qty":"200g"},{"name":"Jalapenos, sliced","qty":"1/4 cup"},{"name":"Cherry tomatoes, diced","qty":"150g"},{"name":"Red onion, diced","qty":"1/2"},{"name":"Sour cream","qty":"to serve"},{"name":"Guacamole","qty":"to serve"},{"name":"Fresh coriander","qty":"to finish"}]$j$::jsonb,
  $s$["Preheat the oven to 200C (400F) and spread the tortilla chips in a single layer on a baking tray.","Scatter the black beans and grated cheese evenly over the chips.","Bake for 8-10 minutes until the cheese is fully melted and bubbling.","Top with jalapenos, cherry tomatoes, and red onion.","Finish with dollops of sour cream and guacamole, and a scatter of fresh coriander.","Serve immediately while hot."]$s$::jsonb,
  $n${"calories":420,"protein":15,"carbs":38,"fat":24}$n$::jsonb,
  2.00
);
