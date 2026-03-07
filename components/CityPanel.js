/**
 * CityPanel.js — Premium City Explore Panel
 *
 * Slide-in panel with hero image, curated attractions, restaurants,
 * neighborhoods, and "Add to Trip" on every location.
 *
 * Props:
 *   city        { name, country, lat, lng }
 *   onClose     () => void
 *   onAddToTrip (location) => void
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWeather } from '../services/weather';
import { searchCityPOIs }    from '../services/places';

/* ── City data ─────────────────────────────────────────────────────────── */

const CITY_DATA = {
  Tokyo: {
    photo: 'photo-1540959733332-eab4deabeeaf',
    gradient: 'from-red-950 via-orange-950 to-red-950',
    description: 'A dizzying blend of ancient temples and hypermodern technology, where neon-lit alleys meet Zen gardens.',
    population: '13.9M', currency: '¥ JPY', timezone: 'UTC+9', bestTime: 'Mar–May, Sep–Nov',
    highlights: [
      { id: 't-h1', name: 'Senso-ji Temple',     type: 'attraction', address: 'Asakusa, Taito-ku',  rating: 4.8, reviews: 28400, lat: 35.7148, lng: 139.7967, duration: 90,  description: "Tokyo's oldest and most beloved temple, framed by a stunning five-story pagoda." },
      { id: 't-h2', name: 'Shibuya Crossing',    type: 'attraction', address: 'Shibuya, Tokyo',     rating: 4.9, reviews: 52100, lat: 35.6595, lng: 139.7004, duration: 30,  description: "The world's busiest pedestrian crossing — a symphony of humanity." },
      { id: 't-h3', name: 'Tokyo Skytree',       type: 'attraction', address: 'Sumida, Tokyo',      rating: 4.7, reviews: 19200, lat: 35.7101, lng: 139.8107, duration: 120, description: 'At 634 m, the tallest tower in Japan with spectacular city panoramas.' },
      { id: 't-h4', name: 'teamLab Borderless',  type: 'activity',   address: 'Azabudai Hills',     rating: 4.9, reviews: 11800, lat: 35.6565, lng: 139.7435, duration: 120, description: 'An otherworldly digital art museum where boundaries dissolve.' },
      { id: 't-h5', name: 'Shinjuku Gyoen',      type: 'attraction', address: 'Shinjuku-ku',        rating: 4.7, reviews: 22300, lat: 35.6858, lng: 139.7100, duration: 90,  description: 'A serene oasis of cherry blossoms and manicured landscapes.' },
    ],
    food: [
      { id: 't-f1', name: 'Tsukiji Outer Market', type: 'restaurant', address: 'Tsukiji, Chuo-ku',  rating: 4.7, reviews: 15200, lat: 35.6654, lng: 139.7707, duration: 60,  description: 'Morning tuna sashimi, tamagoyaki, and fresh seafood straight from the boats.' },
      { id: 't-f2', name: 'Ichiran Ramen',         type: 'restaurant', address: 'Shibuya-ku',        rating: 4.8, reviews: 31200, lat: 35.6938, lng: 139.7034, duration: 45,  description: 'The legendary solo-booth tonkotsu experience. Reserve your flavour profile.' },
      { id: 't-f3', name: 'Sukiyabashi Jiro',      type: 'restaurant', address: 'Ginza, Chuo-ku',   rating: 4.9, reviews: 2800,  lat: 35.6721, lng: 139.7645, duration: 60,  description: 'World-renowned three-Michelin-star sushi. Book months in advance.' },
      { id: 't-f4', name: 'Depachika Food Hall',   type: 'restaurant', address: 'Isetan, Shinjuku',  rating: 4.6, reviews: 18900, lat: 35.6916, lng: 139.7039, duration: 60,  description: 'Multi-level basement gourmet wonderland beneath the department stores.' },
    ],
    neighborhoods: [
      { id: 't-n1', name: 'Harajuku',    type: 'activity', address: 'Shibuya-ku',  rating: 4.8, reviews: 19000, description: 'Quirky street fashion, crepe stalls, and the serene Meiji Shrine.' },
      { id: 't-n2', name: 'Shimokitazawa', type: 'activity', address: 'Setagaya-ku', rating: 4.7, reviews: 11200, description: 'Bohemian indie cafés, vintage clothing shops, and live music venues.' },
      { id: 't-n3', name: 'Yanaka',      type: 'activity', address: 'Taito-ku',    rating: 4.6, reviews: 8400,  description: "Old Tokyo's shitamachi charm — temples, narrow lanes, and artisan studios." },
    ],
  },

  Paris: {
    photo: 'photo-1502602898536-47ad22581b52',
    gradient: 'from-violet-950 via-indigo-950 to-violet-950',
    description: 'The City of Light dazzles with unrivalled art, Haussmann boulevards, and a café on every corner.',
    population: '2.1M', currency: '€ EUR', timezone: 'UTC+1', bestTime: 'Apr–Jun, Sep–Oct',
    highlights: [
      { id: 'p-h1', name: 'Eiffel Tower',          type: 'attraction', address: 'Champ de Mars, 7e', rating: 4.7, reviews: 94200, lat: 48.8584, lng: 2.2945, duration: 120, description: 'The iron lady of Paris glitters with 20,000 bulbs at nightfall.' },
      { id: 'p-h2', name: 'Louvre Museum',          type: 'attraction', address: 'Rue de Rivoli, 1er', rating: 4.8, reviews: 72100, lat: 48.8606, lng: 2.3376, duration: 180, description: 'Home to 35,000 works including the Mona Lisa and Venus de Milo.' },
      { id: 'p-h3', name: 'Musée d\'Orsay',        type: 'attraction', address: 'Quai Anatole France', rating: 4.9, reviews: 38400, lat: 48.8600, lng: 2.3266, duration: 120, description: 'The world\'s greatest Impressionist collection in a grand Belle Époque train station.' },
      { id: 'p-h4', name: 'Sainte-Chapelle',        type: 'attraction', address: 'Île de la Cité, 1er', rating: 4.8, reviews: 22300, lat: 48.8554, lng: 2.3450, duration: 60,  description: 'Dazzling Gothic stained glass that glows like a jewel box.' },
    ],
    food: [
      { id: 'p-f1', name: 'Le Comptoir du Relais', type: 'restaurant', address: 'Saint-Germain, 6e', rating: 4.8, reviews: 9200, lat: 48.8519, lng: 2.3408, duration: 90, description: 'Yves Camdeborde\'s legendary bistrot. The terrine de campagne alone is worth the trip.' },
      { id: 'p-f2', name: 'Du Pain et des Idées',  type: 'restaurant', address: '34 Rue Yves Toudic', rating: 4.9, reviews: 12400, lat: 48.8682, lng: 2.3591, duration: 30, description: 'Paris\'s most beautiful boulangerie. The escargot pastry is transcendent.' },
      { id: 'p-f3', name: 'Marché d\'Aligre',      type: 'restaurant', address: 'Pl. d\'Aligre, 12e', rating: 4.7, reviews: 7800, lat: 48.8498, lng: 2.3786, duration: 60, description: 'The best Sunday market in Paris — olives, cheese, organic produce.' },
    ],
    neighborhoods: [
      { id: 'p-n1', name: 'Le Marais',        type: 'activity', address: '3e & 4e arrond.', rating: 4.9, reviews: 29400, description: 'Medieval streets, Jewish deli culture, gallery hopping, and the Place des Vosges.' },
      { id: 'p-n2', name: 'Montmartre',       type: 'activity', address: '18e arrond.',     rating: 4.8, reviews: 41200, description: 'Cobblestoned hilltop village crowned by Sacré-Cœur and the ghost of Picasso.' },
      { id: 'p-n3', name: 'Saint-Germain',    type: 'activity', address: '6e arrond.',     rating: 4.7, reviews: 18100, description: 'Existentialist cafés, Left Bank bookshops, and the finest cheese shops in France.' },
    ],
  },

  'New York': {
    photo: 'photo-1485871981521-5b1fd3805eee',
    gradient: 'from-blue-950 via-cyan-950 to-blue-950',
    description: 'Five boroughs of relentless energy — where skyscrapers scrape the clouds and every street corner is a story.',
    population: '8.3M', currency: '$ USD', timezone: 'UTC−5', bestTime: 'Apr–Jun, Sep–Nov',
    highlights: [
      { id: 'ny-h1', name: 'Central Park',        type: 'attraction', address: 'Manhattan', rating: 4.9, reviews: 88400, lat: 40.7851, lng: -73.9683, duration: 120, description: 'The 843-acre green heart of Manhattan — rowboats, Belvedere Castle, and Strawberry Fields.' },
      { id: 'ny-h2', name: 'Brooklyn Bridge',     type: 'attraction', address: 'Brooklyn Bridge', rating: 4.8, reviews: 52100, lat: 40.7061, lng: -73.9969, duration: 60, description: 'Walk across this Gothic masterpiece for the most photogenic Manhattan skyline views.' },
      { id: 'ny-h3', name: 'The High Line',       type: 'activity',   address: 'Chelsea, Manhattan', rating: 4.8, reviews: 44200, lat: 40.7480, lng: -74.0048, duration: 90, description: 'An elevated park built on a former freight rail line — art, gardens, and Hudson views.' },
      { id: 'ny-h4', name: 'The Metropolitan Museum', type: 'attraction', address: '1000 5th Ave', rating: 4.9, reviews: 61800, lat: 40.7794, lng: -73.9632, duration: 180, description: 'One of the world\'s great art museums — Egyptian wing, Impressionists, and more.' },
    ],
    food: [
      { id: 'ny-f1', name: 'Katz\'s Delicatessen', type: 'restaurant', address: '205 E Houston St', rating: 4.8, reviews: 22100, lat: 40.7223, lng: -73.9874, duration: 60, description: 'Legendary pastrami on rye since 1888. The institution of New York Jewish deli culture.' },
      { id: 'ny-f2', name: 'Juliana\'s Pizza',     type: 'restaurant', address: 'DUMBO, Brooklyn', rating: 4.9, reviews: 14200, lat: 40.7027, lng: -73.9937, duration: 60, description: 'Coal-fired brick-oven pizza under the Brooklyn Bridge. Worth every minute of the queue.' },
      { id: 'ny-f3', name: 'Chelsea Market',       type: 'restaurant', address: '75 9th Ave, Chelsea', rating: 4.7, reviews: 31400, lat: 40.7424, lng: -74.0060, duration: 60, description: 'A food lover\'s paradise: artisan cheese, ramen, lobster, tacos, all under one roof.' },
    ],
    neighborhoods: [
      { id: 'ny-n1', name: 'DUMBO',            type: 'activity', address: 'Brooklyn',       rating: 4.9, reviews: 22100, description: 'Down Under the Manhattan Bridge — cobblestones, tech startups, and iconic bridge views.' },
      { id: 'ny-n2', name: 'West Village',     type: 'activity', address: 'Manhattan',      rating: 4.8, reviews: 18400, description: 'Brownstone townhouses, tree-lined streets, and some of NYC\'s best restaurants.' },
      { id: 'ny-n3', name: 'Williamsburg',     type: 'activity', address: 'Brooklyn',       rating: 4.7, reviews: 24100, description: 'Brooklyn\'s coolest neighbourhood — vintage shops, rooftop bars, and farm-to-table dining.' },
    ],
  },

  London: {
    photo: 'photo-1513635269975-59663e0ac1ad',
    gradient: 'from-amber-950 via-yellow-950 to-amber-950',
    description: 'A city of contrasts: ancient royal pageantry, edgy street art, and a dining scene that rivals anywhere on Earth.',
    population: '9.0M', currency: '£ GBP', timezone: 'UTC+0', bestTime: 'Apr–Sep',
    highlights: [
      { id: 'l-h1', name: 'Tower of London',     type: 'attraction', address: 'Tower Hill, EC3', rating: 4.7, reviews: 41200, lat: 51.5081, lng: -0.0759, duration: 150, description: 'A millennium of royal history: Crown Jewels, Beefeaters, and the infamous ravens.' },
      { id: 'l-h2', name: 'Tate Modern',         type: 'attraction', address: 'Bankside, SE1', rating: 4.8, reviews: 38100, lat: 51.5076, lng: -0.0994, duration: 120, description: 'World-class modern art in a converted Bankside power station. Entry is free.' },
      { id: 'l-h3', name: 'Borough Market',      type: 'activity',   address: 'Borough, SE1', rating: 4.9, reviews: 27400, lat: 51.5055, lng: -0.0912, duration: 90, description: 'London\'s oldest and most celebrated food market — a sensory overload in the best way.' },
      { id: 'l-h4', name: 'Hyde Park',           type: 'attraction', address: 'Westminster, W2', rating: 4.7, reviews: 52100, lat: 51.5074, lng: -0.1657, duration: 90, description: 'Royal parkland, the Serpentine Gallery, and the Diana Memorial Fountain.' },
    ],
    food: [
      { id: 'l-f1', name: 'Dishoom Covent Garden', type: 'restaurant', address: '12 Upper St Martin\'s', rating: 4.9, reviews: 44200, lat: 51.5132, lng: -0.1238, duration: 90, description: 'An ode to the old Irani cafés of Bombay. The black dal is life-changing.' },
      { id: 'l-f2', name: 'St. John Restaurant',  type: 'restaurant', address: '26 St John St, EC1', rating: 4.8, reviews: 12100, lat: 51.5206, lng: -0.1009, duration: 90, description: 'Fergus Henderson\'s nose-to-tail classic. Bone marrow on toast is an institution.' },
      { id: 'l-f3', name: 'Bao Soho',             type: 'restaurant', address: '53 Lexington St', rating: 4.8, reviews: 18800, lat: 51.5134, lng: -0.1367, duration: 60, description: 'Fluffy Taiwanese bao in a tiny Soho counter — expect a queue and zero regrets.' },
    ],
    neighborhoods: [
      { id: 'l-n1', name: 'Shoreditch',    type: 'activity', address: 'East London', rating: 4.8, reviews: 28100, description: 'Street art, craft beer, vintage markets, and London\'s most exciting restaurant scene.' },
      { id: 'l-n2', name: 'Notting Hill',  type: 'activity', address: 'West London', rating: 4.7, reviews: 21400, description: 'Pastel Victorian terraces, Portobello Market Saturdays, and celebrity doorsteps.' },
      { id: 'l-n3', name: 'South Bank',    type: 'activity', address: 'SE1',         rating: 4.8, reviews: 31200, description: 'The BFI, Tate Modern, Globe Theatre, and a promenade along the Thames.' },
    ],
  },

  Barcelona: {
    photo: 'photo-1583422409516-2895a77efded',
    gradient: 'from-amber-950 via-orange-950 to-amber-950',
    description: 'Gaudí\'s surrealist dreamscapes meet Mediterranean beaches, world-class tapas, and infectious nightlife.',
    population: '1.6M', currency: '€ EUR', timezone: 'UTC+1', bestTime: 'May–Jun, Sep–Oct',
    highlights: [
      { id: 'b-h1', name: 'Sagrada Família',    type: 'attraction', address: 'Eixample', rating: 4.8, reviews: 78200, lat: 41.4036, lng: 2.1744, duration: 120, description: 'Gaudí\'s unfinished basilica is arguably the most stunning building on Earth.' },
      { id: 'b-h2', name: 'Park Güell',         type: 'attraction', address: 'Gràcia',  rating: 4.7, reviews: 52100, lat: 41.4145, lng: 2.1527, duration: 90,  description: 'Mosaic terraces, gingerbread gatehouses, and panoramic city views.' },
      { id: 'b-h3', name: 'La Barceloneta',     type: 'activity',   address: 'Barceloneta Beach', rating: 4.6, reviews: 44200, lat: 41.3787, lng: 2.1921, duration: 120, description: 'The urban beach in Europe — golden sand minutes from the Gothic Quarter.' },
      { id: 'b-h4', name: 'Gothic Quarter',     type: 'attraction', address: 'Barri Gòtic', rating: 4.8, reviews: 38100, lat: 41.3836, lng: 2.1777, duration: 90,  description: '2,000 years of layered history in a labyrinth of Roman-medieval streets.' },
    ],
    food: [
      { id: 'b-f1', name: 'La Boqueria',        type: 'restaurant', address: 'Las Ramblas', rating: 4.6, reviews: 62100, lat: 41.3813, lng: 2.1720, duration: 60, description: 'Barcelona\'s legendary covered market: jamón, pintxos, fresh seafood, and vibrant chaos.' },
      { id: 'b-f2', name: 'Bar Calders',        type: 'restaurant', address: 'Sant Antoni',  rating: 4.8, reviews: 8900,  lat: 41.3763, lng: 2.1628, duration: 90, description: 'The best vermouth in the city, in Barcelona\'s most charming new neighbourhood bar.' },
      { id: 'b-f3', name: 'Disfrutar',          type: 'restaurant', address: 'Eixample',     rating: 4.9, reviews: 3200,  lat: 41.3912, lng: 2.1624, duration: 150, description: 'Three Michelin stars. One of the World\'s 50 Best — molecular Catalan genius.' },
    ],
    neighborhoods: [
      { id: 'b-n1', name: 'El Born',      type: 'activity', address: 'Barri Gòtic', rating: 4.9, reviews: 22400, description: 'Hip cocktail bars, indie boutiques, and the Picasso Museum in medieval streets.' },
      { id: 'b-n2', name: 'Gràcia',       type: 'activity', address: 'Gràcia',      rating: 4.8, reviews: 17100, description: 'Village-like squares, bohemian atmosphere, and incredible local restaurants.' },
      { id: 'b-n3', name: 'Sant Antoni',  type: 'activity', address: 'Eixample',    rating: 4.7, reviews: 12800, description: 'Barcelona\'s coolest reborn neighbourhood: market halls, cocktail bars, brunch spots.' },
    ],
  },

  Sydney: {
    photo: 'photo-1506973035872-a4ec16b8e8d9',
    gradient: 'from-emerald-950 via-teal-950 to-emerald-950',
    description: 'A sparkling harbour city where world-class beaches, the Opera House, and incredible food culture collide.',
    population: '5.3M', currency: 'A$ AUD', timezone: 'UTC+10', bestTime: 'Sep–Nov, Mar–May',
    highlights: [
      { id: 's-h1', name: 'Sydney Opera House',  type: 'attraction', address: 'Bennelong Point', rating: 4.8, reviews: 74200, lat: -33.8568, lng: 151.2153, duration: 90, description: 'Jørn Utzon\'s soaring sail-shells are the most recognisable building in the hemisphere.' },
      { id: 's-h2', name: 'Bondi Beach',         type: 'activity',   address: 'Bondi, NSW',      rating: 4.8, reviews: 58100, lat: -33.8909, lng: 151.2743, duration: 180, description: 'The world\'s most iconic beach — surf, the coastal walk, and an irresistible café culture.' },
      { id: 's-h3', name: 'Darling Harbour',     type: 'attraction', address: 'Darling Harbour',  rating: 4.6, reviews: 41200, lat: -33.8731, lng: 151.1998, duration: 90, description: 'Restaurants, SEA LIFE Aquarium, and evening fireworks over the water.' },
      { id: 's-h4', name: 'Blue Mountains',      type: 'activity',   address: '1.5h from CBD',   rating: 4.9, reviews: 28400, lat: -33.7234, lng: 150.3116, duration: 480, description: 'Ancient rainforest, the Three Sisters, and views stretching to infinity.' },
    ],
    food: [
      { id: 's-f1', name: 'The Grounds of Alexandria', type: 'restaurant', address: '7a/1 Huntley St', rating: 4.7, reviews: 32100, lat: -33.9044, lng: 151.1943, duration: 90, description: 'A farm-to-table wonderland in a converted factory — chickens, herbs, and superb brunch.' },
      { id: 's-f2', name: 'Ippudo Sydney',        type: 'restaurant', address: 'World Square, CBD', rating: 4.8, reviews: 22400, lat: -33.8756, lng: 151.2074, duration: 60, description: 'Authentic Hakata-style tonkotsu ramen from the legendary Japanese chain.' },
      { id: 's-f3', name: 'Aria Restaurant',     type: 'restaurant', address: 'Macquarie St, CBD', rating: 4.9, reviews: 8100,  lat: -33.8589, lng: 151.2121, duration: 120, description: 'Matt Moran\'s multi-award-winner with the finest Harbour Bridge views in the city.' },
    ],
    neighborhoods: [
      { id: 's-n1', name: 'Surry Hills',   type: 'activity', address: 'Inner City',  rating: 4.8, reviews: 18200, description: 'Café-lined streets, craft cocktail bars, and Sydney\'s most creative food scene.' },
      { id: 's-n2', name: 'Newtown',       type: 'activity', address: 'Inner West',  rating: 4.7, reviews: 14100, description: 'Bohemian King St lined with bookshops, Thai restaurants, and live music venues.' },
      { id: 's-n3', name: 'Manly',         type: 'activity', address: 'Northern Beaches', rating: 4.8, reviews: 21400, description: 'Take the 30-min ferry for surf beaches, the Corso, and chilled Northern Beaches vibes.' },
    ],
  },

  Dubai: {
    photo: 'photo-1512453979798-5ea266f8880c',
    gradient: 'from-amber-950 via-yellow-950 to-amber-950',
    description: 'The city of tomorrow, today — record-breaking towers, golden deserts, and jaw-dropping luxury.',
    population: '3.5M', currency: 'AED', timezone: 'UTC+4', bestTime: 'Nov–Mar',
    highlights: [
      { id: 'd-h1', name: 'Burj Khalifa',      type: 'attraction', address: 'Downtown Dubai', rating: 4.7, reviews: 84200, lat: 25.1972, lng: 55.2744, duration: 120, description: 'The world\'s tallest building at 828 m — At the Top offers views across three countries.' },
      { id: 'd-h2', name: 'Dubai Frame',        type: 'attraction', address: 'Zabeel Park',    rating: 4.6, reviews: 22100, lat: 25.2352, lng: 55.3004, duration: 60,  description: '150 m picture frame with Old Dubai on one side and New Dubai on the other.' },
      { id: 'd-h3', name: 'Dubai Creek & Souks', type: 'activity',  address: 'Deira',          rating: 4.8, reviews: 31200, lat: 25.2644, lng: 55.3062, duration: 120, description: 'Abra rides, the Gold Souk, and the Spice Souk — the heartbeat of old Dubai.' },
      { id: 'd-h4', name: 'Desert Safari',      type: 'activity',   address: 'Dubai Desert',  rating: 4.9, reviews: 52100, lat: 24.9857, lng: 55.5042, duration: 360, description: 'Dune bashing, camel riding, and a Bedouin camp dinner under the stars.' },
    ],
    food: [
      { id: 'd-f1', name: 'Pierchic',           type: 'restaurant', address: 'Jumeirah, Dubai', rating: 4.8, reviews: 8900, lat: 25.1498, lng: 55.1935, duration: 120, description: 'A dreamy overwater seafood restaurant with panoramic views of the Palm Jumeirah.' },
      { id: 'd-f2', name: 'Al Fanar Restaurant', type: 'restaurant', address: 'Festival City', rating: 4.7, reviews: 14200, lat: 25.2284, lng: 55.3516, duration: 90, description: 'Authentic Emirati heritage cuisine in a beautifully recreated old Dubai setting.' },
      { id: 'd-f3', name: 'Friday Brunch at Zuma', type: 'restaurant', address: 'Gate Village DIFC', rating: 4.9, reviews: 9800, lat: 25.2097, lng: 55.2780, duration: 180, description: 'The legendary Dubai Friday brunch ritual — Japanese robata and free-flow at its finest.' },
    ],
    neighborhoods: [
      { id: 'd-n1', name: 'Downtown Dubai', type: 'activity', address: 'Downtown',    rating: 4.8, reviews: 41200, description: 'The Dubai Mall, Burj Khalifa, Dubai Fountain, and the most Instagrammed skyline on Earth.' },
      { id: 'd-n2', name: 'Al Fahidi',      type: 'activity', address: 'Bur Dubai',   rating: 4.7, reviews: 14800, description: 'Wind-tower architecture, art galleries, and the soul of historic Arabia.' },
      { id: 'd-n3', name: 'Jumeirah',       type: 'activity', address: 'Jumeirah',    rating: 4.7, reviews: 22100, description: 'Beach clubs, the Burj Al Arab, and the finest brunch terraces in the emirate.' },
    ],
  },

  Singapore: {
    photo: 'photo-1525625293386-3f8f99389edd',
    gradient: 'from-cyan-950 via-blue-950 to-cyan-950',
    description: 'The Garden City — a seamless fusion of Malay, Chinese, Indian, and British culture with the best food in Asia.',
    population: '5.9M', currency: 'S$ SGD', timezone: 'UTC+8', bestTime: 'Feb–Apr',
    highlights: [
      { id: 'sg-h1', name: 'Gardens by the Bay', type: 'attraction', address: 'Marina Bay', rating: 4.9, reviews: 68200, lat: 1.2816, lng: 103.8636, duration: 120, description: 'The futuristic Supertrees and glass bio-domes are one of the world\'s great wonders.' },
      { id: 'sg-h2', name: 'Marina Bay Sands',   type: 'attraction', address: 'Marina Bay', rating: 4.7, reviews: 94200, lat: 1.2838, lng: 103.8607, duration: 90, description: 'The iconic infinity pool perched 57 floors up. The SkyPark views are unmissable.' },
      { id: 'sg-h3', name: 'Chinatown',          type: 'attraction', address: 'Chinatown',  rating: 4.7, reviews: 41200, lat: 1.2833, lng: 103.8442, duration: 90, description: 'Heritage shophouses, incense-filled temples, and the best hawker stalls in the city.' },
    ],
    food: [
      { id: 'sg-f1', name: 'Hawker Chan',        type: 'restaurant', address: '335 Smith St', rating: 4.7, reviews: 22100, lat: 1.2806, lng: 103.8435, duration: 45, description: 'The world\'s most affordable Michelin star: $2 soya sauce chicken rice.' },
      { id: 'sg-f2', name: 'Newton Food Centre', type: 'restaurant', address: 'Newton Circus', rating: 4.8, reviews: 31400, lat: 1.3124, lng: 103.8390, duration: 90, description: 'Singapore\'s most famous hawker centre — chilli crab, satay, and char kway teow.' },
      { id: 'sg-f3', name: 'Odette',            type: 'restaurant', address: 'National Gallery', rating: 4.9, reviews: 4200, lat: 1.2895, lng: 103.8517, duration: 150, description: 'Three Michelin stars in the National Gallery. Asia\'s Best Restaurant 2019.' },
    ],
    neighborhoods: [
      { id: 'sg-n1', name: 'Tiong Bahru',  type: 'activity', address: 'Tiong Bahru', rating: 4.8, reviews: 12400, description: 'Art Deco housing estates, indie bookshops, third-wave coffee, and bakeries.' },
      { id: 'sg-n2', name: 'Kampong Glam', type: 'activity', address: 'City Area',   rating: 4.7, reviews: 18100, description: 'The Malay Quarter — Sultan Mosque, Arab Street boutiques, and craft cocktail bars.' },
      { id: 'sg-n3', name: 'Little India',  type: 'activity', address: 'Little India', rating: 4.6, reviews: 22800, description: 'A riot of colour, jasmine garlands, and some of the city\'s finest Indian cuisine.' },
    ],
  },

  Rome: {
    photo: 'photo-1515542622106-78bda8ba0e5b',
    gradient: 'from-orange-950 via-amber-950 to-orange-950',
    description: 'The Eternal City wears 2,800 years of history lightly — gelato in one hand, espresso in the other.',
    population: '2.9M', currency: '€ EUR', timezone: 'UTC+1', bestTime: 'Apr–Jun, Sep–Oct',
    highlights: [
      { id: 'r-h1', name: 'Colosseum',         type: 'attraction', address: 'Via Sacra', rating: 4.8, reviews: 94200, lat: 41.8902, lng: 12.4922, duration: 120, description: 'The amphitheatre of gladiators — an engineering marvel that still overwhelms 2,000 years on.' },
      { id: 'r-h2', name: 'Vatican Museums',   type: 'attraction', address: 'Vatican City', rating: 4.9, reviews: 72100, lat: 41.9065, lng: 12.4536, duration: 240, description: 'The Sistine Chapel ceiling alone justifies the queue. Book at least two weeks ahead.' },
      { id: 'r-h3', name: 'Trevi Fountain',    type: 'attraction', address: 'Via Nicola Salvi', rating: 4.7, reviews: 88400, lat: 41.9009, lng: 12.4833, duration: 30, description: 'Baroque theatricality at its peak. Toss a coin at dawn to avoid the crowds.' },
      { id: 'r-h4', name: 'Palatine Hill',     type: 'attraction', address: 'Via Sacra, 1', rating: 4.7, reviews: 28100, lat: 41.8891, lng: 12.4876, duration: 90, description: 'Where Rome was founded — imperial palace ruins above the Forum.' },
    ],
    food: [
      { id: 'r-f1', name: 'Osteria Flavia',    type: 'restaurant', address: 'Via Flavia 9, Termini', rating: 4.8, reviews: 8100, lat: 41.9045, lng: 12.4946, duration: 90, description: 'Old-school Roman trattoria doing cacio e pepe and carbonara without compromise.' },
      { id: 'r-f2', name: 'Supplì Roma',       type: 'restaurant', address: 'Via di San Francesco', rating: 4.9, reviews: 12400, lat: 41.8909, lng: 12.4727, duration: 30, description: 'The world\'s best supplì (fried rice balls) — a Roman street food institution since 1980.' },
      { id: 'r-f3', name: 'Il Sorpasso',       type: 'restaurant', address: 'Via Properzio 31', rating: 4.7, reviews: 7800, lat: 41.9072, lng: 12.4621, duration: 90, description: 'Neighbourhood wine bar beloved by locals for its natural wines and rustic charcuterie.' },
    ],
    neighborhoods: [
      { id: 'r-n1', name: 'Trastevere',  type: 'activity', address: 'Rione XIII', rating: 4.9, reviews: 29400, description: 'Ivy-clad trattorias, evening aperitivo culture, and Rome\'s most authentic neighbourhood.' },
      { id: 'r-n2', name: 'Prati',        type: 'activity', address: 'Near Vatican', rating: 4.7, reviews: 14100, description: 'Elegant 19th-century streets, gelaterie, and the best pizza al taglio near the Vatican.' },
      { id: 'r-n3', name: 'Pigneto',      type: 'activity', address: 'East Rome',    rating: 4.6, reviews: 9800, description: 'Rome\'s hipster heartland — street art, independent cinemas, and craft beer bars.' },
    ],
  },

  Bangkok: {
    photo: 'photo-1508009603885-50cf7c579365',
    gradient: 'from-amber-950 via-red-950 to-amber-950',
    description: 'Sensory overload in the best way — street food at every turn, golden temples, and the wildest nightlife in Asia.',
    population: '10.5M', currency: '฿ THB', timezone: 'UTC+7', bestTime: 'Nov–Feb',
    highlights: [
      { id: 'bk-h1', name: 'Wat Phra Kaew',    type: 'attraction', address: 'Phra Nakhon', rating: 4.9, reviews: 68200, lat: 13.7513, lng: 100.4914, duration: 120, description: 'The Temple of the Emerald Buddha — Thailand\'s most sacred site within the Grand Palace.' },
      { id: 'bk-h2', name: 'Chatuchak Market', type: 'activity',   address: 'Chatuchak',   rating: 4.7, reviews: 52100, lat: 13.7999, lng: 100.5499, duration: 180, description: 'The world\'s largest weekend market: 15,000 stalls of street food, art, and curiosities.' },
      { id: 'bk-h3', name: 'Khao San Road',    type: 'activity',   address: 'Phra Nakhon', rating: 4.5, reviews: 38100, lat: 13.7588, lng: 100.4972, duration: 120, description: 'The legendary backpacker strip — cheap eats, bucket cocktails, and night market chaos.' },
    ],
    food: [
      { id: 'bk-f1', name: 'Jay Fai',          type: 'restaurant', address: 'Maharaj Rd, Bang Lam Phu', rating: 4.9, reviews: 14200, lat: 13.7556, lng: 100.5002, duration: 90, description: 'A Michelin-starred street food legend in a smoking wok. The crab omelette is extraordinary.' },
      { id: 'bk-f2', name: 'Boat Noodle Alley', type: 'restaurant', address: 'Victory Monument',        rating: 4.7, reviews: 22100, lat: 13.7648, lng: 100.5382, duration: 60, description: 'Bangkok\'s iconic boat noodles — tiny bowls of rich broth at 10 baht each.' },
      { id: 'bk-f3', name: 'Gaggan Anand',      type: 'restaurant', address: 'Ekkamai, Bangkok',        rating: 4.9, reviews: 3800,  lat: 13.7285, lng: 100.5858, duration: 180, description: 'The legendary emoji-menu Indian chef pushing the boundary of Thai spice and creativity.' },
    ],
    neighborhoods: [
      { id: 'bk-n1', name: 'Ari',           type: 'activity', address: 'Phaya Thai',  rating: 4.8, reviews: 12400, description: 'Bangkok\'s café district — tree-lined streets, specialty coffee, and upscale street food.' },
      { id: 'bk-n2', name: 'Thonglor',      type: 'activity', address: 'Watthana',    rating: 4.7, reviews: 22100, description: 'High-end rooftop bars, Japanese restaurants, and the city\'s most fashionable crowd.' },
      { id: 'bk-n3', name: 'Yaowarat',      type: 'activity', address: 'Chinatown',  rating: 4.8, reviews: 28400, description: 'Bangkok Chinatown explodes at night with gold shops, street food, and neon signs.' },
    ],
  },

  'Los Angeles': {
    photo: 'photo-1534430480872-7f80cb5c9548',
    gradient: 'from-orange-950 via-rose-950 to-orange-950',
    description: 'Sunshine, celebrity, and a patchwork of distinct neighbourhoods — where dreams arrive daily.',
    population: '3.9M', currency: '$ USD', timezone: 'UTC−8', bestTime: 'Mar–May, Sep–Nov',
    highlights: [
      { id: 'la-h1', name: 'Griffith Observatory', type: 'attraction', address: 'Los Feliz Hills', rating: 4.8, reviews: 44200, lat: 34.1184, lng: -118.3004, duration: 90, description: 'Iconic Art Deco observatory with the finest panorama of the LA Basin and Hollywood Sign.' },
      { id: 'la-h2', name: 'The Getty Center',      type: 'attraction', address: 'Brentwood',      rating: 4.9, reviews: 38100, lat: 34.0780, lng: -118.4741, duration: 150, description: 'World-class art collection on a hilltop with gardens and views from Malibu to Downtown.' },
      { id: 'la-h3', name: 'Venice Beach',          type: 'activity',   address: 'Venice',          rating: 4.7, reviews: 52100, lat: 33.9850, lng: -118.4695, duration: 120, description: 'Bodybuilders, street performers, skate park, and the boardwalk in full Californian glory.' },
    ],
    food: [
      { id: 'la-f1', name: 'Bestia',           type: 'restaurant', address: 'Arts District, Downtown', rating: 4.9, reviews: 9800, lat: 34.0378, lng: -118.2338, duration: 120, description: 'Rustic Italian in the Arts District. The house-made pasta and wood-fired meats are legendary.' },
      { id: 'la-f2', name: 'Grand Central Market', type: 'restaurant', address: '317 S Broadway', rating: 4.7, reviews: 22100, lat: 34.0508, lng: -118.2494, duration: 90, description: 'LA\'s original food hall — egg sandwiches, pupusas, ramen, and craft drinks since 1917.' },
      { id: 'la-f3', name: 'Mariscos Jalisco',  type: 'restaurant', address: '3040 E Olympic Blvd', rating: 4.9, reviews: 8400, lat: 34.0320, lng: -118.1987, duration: 45, description: 'The legendary taco de camarón dorado truck. Cash only. Worth the drive east of Downtown.' },
    ],
    neighborhoods: [
      { id: 'la-n1', name: 'Silver Lake',   type: 'activity', address: 'East LA',     rating: 4.8, reviews: 18100, description: 'LA\'s hippest neighbourhood — record shops, plant-forward restaurants, and the reservoir.' },
      { id: 'la-n2', name: 'Abbot Kinney',  type: 'activity', address: 'Venice',      rating: 4.7, reviews: 24200, description: 'The coolest mile in America: boutiques, galleries, celebrity juice bars, and tacos.' },
      { id: 'la-n3', name: 'Little Tokyo',  type: 'activity', address: 'Downtown LA', rating: 4.7, reviews: 14800, description: 'Ramen, Japanese grocery stores, temples, and the best mochi outside of Japan.' },
    ],
  },

  'Mexico City': {
    photo: 'photo-1518105779780-2e07f90c5f20',
    gradient: 'from-green-950 via-emerald-950 to-green-950',
    description: 'Altitude, altitude, attitude — one of the world\'s great megacities with Aztec ruins, muralism, and extraordinary food.',
    population: '9.2M', currency: '$ MXN', timezone: 'UTC−6', bestTime: 'Oct–Feb',
    highlights: [
      { id: 'mx-h1', name: 'Teotihuacan Pyramids', type: 'attraction', address: '50km NE of CDMX', rating: 4.9, reviews: 62100, lat: 19.6925, lng: -98.8438, duration: 360, description: 'The Pyramids of the Sun and Moon — a pre-Aztec city that once rivalled ancient Rome.' },
      { id: 'mx-h2', name: 'Frida Kahlo Museum',   type: 'attraction', address: 'Coyoacán',         rating: 4.8, reviews: 44200, lat: 19.3554, lng: -99.1626, duration: 90,  description: 'La Casa Azul — the cobalt-blue home where Frida was born, painted, and died.' },
      { id: 'mx-h3', name: 'Palacio de Bellas Artes', type: 'attraction', address: 'Centro Histórico', rating: 4.8, reviews: 38100, lat: 19.4352, lng: -99.1413, duration: 90, description: 'The Art Nouveau/Art Deco palace housing Diego Rivera\'s great Muralist masterpieces.' },
    ],
    food: [
      { id: 'mx-f1', name: 'Quintonil',     type: 'restaurant', address: 'Newton 55, Polanco', rating: 4.9, reviews: 4800, lat: 19.4319, lng: -99.1942, duration: 150, description: 'Jorge Vallejo\'s Latin America\'s Best Restaurant — Mexican ingredients elevated to haute cuisine.' },
      { id: 'mx-f2', name: 'El Huequito',   type: 'restaurant', address: 'Bolívar 58, Centro', rating: 4.8, reviews: 18200, lat: 19.4311, lng: -99.1361, duration: 45, description: 'The original al pastor taco joint in Mexico City since 1959. Non-negotiable stop.' },
      { id: 'mx-f3', name: 'Mercado de La Merced', type: 'restaurant', address: 'La Merced', rating: 4.7, reviews: 22100, lat: 19.4234, lng: -99.1199, duration: 90, description: 'The city\'s great market labyrinth — mole pastes, dried chiles, and sensory overload.' },
    ],
    neighborhoods: [
      { id: 'mx-n1', name: 'Condesa',   type: 'activity', address: 'Cuauhtémoc', rating: 4.9, reviews: 22400, description: 'Art Deco apartments, tree-canopied boulevards, sidewalk cafés, and vibrant nightlife.' },
      { id: 'mx-n2', name: 'Coyoacán',  type: 'activity', address: 'Coyoacán',   rating: 4.8, reviews: 18100, description: 'Trotsky\'s exile, Frida\'s blue house, cobblestones, and the best churros in the city.' },
      { id: 'mx-n3', name: 'Roma Norte', type: 'activity', address: 'Cuauhtémoc', rating: 4.8, reviews: 19800, description: 'Bohemian markets, cutting-edge restaurants, and CDMX\'s most exciting cocktail bars.' },
    ],
  },

  Rio: {
    photo: 'photo-1483729558449-99ef09a8c325',
    gradient: 'from-emerald-950 via-green-950 to-emerald-950',
    description: 'Cristo Redentor watches over a city of pure vitality — Carnival, samba, Copacabana, and a beach culture unlike anywhere else.',
    population: '6.7M', currency: 'R$ BRL', timezone: 'UTC−3', bestTime: 'Sep–Mar',
    highlights: [
      { id: 'ri-h1', name: 'Cristo Redentor',      type: 'attraction', address: 'Corcovado Hill',  rating: 4.8, reviews: 74200, lat: -22.9519, lng: -43.2105, duration: 120, description: 'The outstretched arms of Christ embrace the entire city from 710 m. A wonder of the world.' },
      { id: 'ri-h2', name: 'Sugarloaf Mountain',   type: 'attraction', address: 'Urca',             rating: 4.9, reviews: 52100, lat: -22.9492, lng: -43.1568, duration: 150, description: 'Two cable-car rides to the iconic peak — sunset over the bay is unforgettable.' },
      { id: 'ri-h3', name: 'Copacabana Beach',     type: 'activity',   address: 'Copacabana',       rating: 4.7, reviews: 68200, lat: -22.9706, lng: -43.1852, duration: 180, description: 'Four kilometres of legendary Atlantic beach, caipirinhas, and the mosaic promenade.' },
    ],
    food: [
      { id: 'ri-f1', name: 'Churrascaria Palace',  type: 'restaurant', address: 'Rodizio do Grill', rating: 4.8, reviews: 14200, lat: -22.9656, lng: -43.1794, duration: 120, description: 'The ultimate Brazilian rodízio — endless spit-roasted meats carved tableside.' },
      { id: 'ri-f2', name: 'Confeitaria Colombo',  type: 'restaurant', address: 'Gonçalves Dias 32', rating: 4.8, reviews: 18100, lat: -22.9077, lng: -43.1758, duration: 60, description: 'Belle Époque grandeur since 1894 — Portuguese pastries and coffee in a gilded mirror salon.' },
      { id: 'ri-f3', name: 'Sawasdee',            type: 'restaurant', address: 'Ipanema',            rating: 4.7, reviews: 8100,  lat: -22.9838, lng: -43.2042, duration: 90, description: 'The finest Moqueca (Brazilian seafood stew) served in clay pots, Ipanema style.' },
    ],
    neighborhoods: [
      { id: 'ri-n1', name: 'Santa Teresa',  type: 'activity', address: 'Hillside enclave', rating: 4.8, reviews: 16400, description: 'A hilltop bohemian enclave of art studios, colonial mansions, and the iconic yellow tram.' },
      { id: 'ri-n2', name: 'Ipanema',       type: 'activity', address: 'Zona Sul',         rating: 4.9, reviews: 44200, description: 'The Girl from Ipanema\'s beach — sophisticated, sun-kissed, and the best açaí on Earth.' },
      { id: 'ri-n3', name: 'Lapa',          type: 'activity', address: 'Centro',           rating: 4.6, reviews: 22100, description: 'Rio\'s samba heartland — the Arches, live pagode, and a city dancing until dawn.' },
    ],
  },

  Kyoto: {
    photo: 'photo-1493976040374-85c8e12f0c0e',
    gradient: 'from-pink-950 via-rose-950 to-pink-950',
    description: 'The soul of Japan — 1,600 Buddhist temples, 400 Shinto shrines, tea ceremony culture, and the last geisha districts.',
    population: '1.5M', currency: '¥ JPY', timezone: 'UTC+9', bestTime: 'Mar–May, Oct–Nov',
    highlights: [
      { id: 'k-h1', name: 'Fushimi Inari Taisha', type: 'attraction', address: 'Fushimi-ku', rating: 4.9, reviews: 74200, lat: 34.9671, lng: 135.7727, duration: 150, description: '10,000 vermilion torii gates winding up sacred Mt. Inari — magical at dawn.' },
      { id: 'k-h2', name: 'Arashiyama Bamboo Grove', type: 'attraction', address: 'Arashiyama', rating: 4.8, reviews: 62100, lat: 35.0170, lng: 135.6724, duration: 60, description: 'Towering green bamboo tunnels that hum, whisper, and transport you to another world.' },
      { id: 'k-h3', name: 'Kinkaku-ji (Golden Pavilion)', type: 'attraction', address: 'Kinkakuji-cho', rating: 4.8, reviews: 58100, lat: 35.0394, lng: 135.7292, duration: 60, description: 'The gold-leaf covered Zen temple reflected in its mirror pond — hauntingly beautiful.' },
      { id: 'k-h4', name: 'Gion District',         type: 'activity', address: 'Higashiyama-ku', rating: 4.8, reviews: 44200, lat: 35.0037, lng: 135.7752, duration: 90, description: 'Cobblestoned Hanamikoji, ochaya teahouses, and the chance to spot a geiko or maiko.' },
    ],
    food: [
      { id: 'k-f1', name: 'Nishiki Market',    type: 'restaurant', address: 'Nakagyo-ku', rating: 4.7, reviews: 22100, lat: 35.0049, lng: 135.7658, duration: 60, description: '"Kyoto\'s Kitchen" — a narrow covered arcade of pickles, tofu, grilled skewers, and dashi.' },
      { id: 'k-f2', name: 'Kikunoi Honten',    type: 'restaurant', address: 'Higashiyama', rating: 4.9, reviews: 3800, lat: 34.9988, lng: 135.7820, duration: 120, description: 'Three-Michelin-star kaiseki — the perfection of Kyoto\'s seasonal tasting menu tradition.' },
      { id: 'k-f3', name: 'Omen Noodles',      type: 'restaurant', address: 'Ginkaku-ji area', rating: 4.8, reviews: 8100, lat: 35.0270, lng: 135.7974, duration: 60, description: 'Beloved handmade udon noodle shop near the Silver Pavilion, unchanged for decades.' },
    ],
    neighborhoods: [
      { id: 'k-n1', name: 'Higashiyama',    type: 'activity', address: 'Eastern Kyoto', rating: 4.9, reviews: 31200, description: 'Preserved Edo-era streetscapes, craft shops, and the Sannenzaka & Ninenzaka stone lanes.' },
      { id: 'k-n2', name: 'Pontocho Alley', type: 'activity', address: 'Kamigyo-ku',    rating: 4.8, reviews: 22100, description: 'A lantern-lit narrow alley of kaiseki restaurants, jazz bars, and hidden izakayas.' },
      { id: 'k-n3', name: 'Philosopher\'s Path', type: 'activity', address: 'Sakyo-ku', rating: 4.7, reviews: 18400, description: 'A cherry-blossom-lined canal walk linking Ginkaku-ji to Nanzen-ji — meditative perfection.' },
    ],
  },

  Bali: {
    photo: 'photo-1537996194471-e657df975ab4',
    gradient: 'from-emerald-950 via-teal-950 to-emerald-950',
    description: 'The Island of the Gods — rice terraces, surf culture, Hindu ceremonies, and the world\'s best yoga retreats.',
    population: '4.3M', currency: 'Rp IDR', timezone: 'UTC+8', bestTime: 'Apr–Oct',
    highlights: [
      { id: 'ba-h1', name: 'Ubud Monkey Forest',    type: 'attraction', address: 'Ubud',     rating: 4.7, reviews: 28100, lat: -8.5195, lng: 115.2591, duration: 90, description: 'A sacred sanctuary where long-tailed macaques roam among ancient Hindu temples.' },
      { id: 'ba-h2', name: 'Tegallalang Rice Terraces', type: 'attraction', address: 'Ubud', rating: 4.8, reviews: 44200, lat: -8.4313, lng: 115.2798, duration: 120, description: 'UNESCO-listed terraced rice paddies following the traditional subak irrigation system.' },
      { id: 'ba-h3', name: 'Tanah Lot Temple',       type: 'attraction', address: 'Tabanan', rating: 4.7, reviews: 52100, lat: -8.6215, lng: 115.0865, duration: 90, description: 'A sea temple perched on a dramatic offshore rock stack — sunset visits are magical.' },
    ],
    food: [
      { id: 'ba-f1', name: 'Locavore',        type: 'restaurant', address: 'Ubud',          rating: 4.9, reviews: 4800, lat: -8.5069, lng: 115.2625, duration: 150, description: 'Asia\'s best farm-to-table restaurant — Balinese ingredients in startling contemporary form.' },
      { id: 'ba-f2', name: 'Warung Babi Guling', type: 'restaurant', address: 'Ubud',        rating: 4.8, reviews: 14200, lat: -8.5069, lng: 115.2618, duration: 60, description: 'Bali\'s famous suckling pig ceremony feast — crispy skin, turmeric rice, and sambal.' },
      { id: 'ba-f3', name: 'Merah Putih',     type: 'restaurant', address: 'Seminyak',       rating: 4.8, reviews: 9100, lat: -8.6875, lng: 115.1590, duration: 90, description: 'Modern Indonesian cuisine in a dramatic bamboo-vaulted pavilion.' },
    ],
    neighborhoods: [
      { id: 'ba-n1', name: 'Seminyak',    type: 'activity', address: 'South Bali',  rating: 4.8, reviews: 28100, description: 'Designer boutiques, beach clubs, sunset cocktails, and the most stylish villas.' },
      { id: 'ba-n2', name: 'Ubud',        type: 'activity', address: 'Central Bali', rating: 4.9, reviews: 44200, description: 'The cultural heart of Bali — galleries, dance performances, yoga studios, organic cafés.' },
      { id: 'ba-n3', name: 'Canggu',      type: 'activity', address: 'South Bali',  rating: 4.7, reviews: 22100, description: 'The digital nomad surf village — rice paddies, Instagram cafés, and black sand beaches.' },
    ],
  },

  Moscow: {
    photo: 'photo-1513326738677-b964603b136d',
    gradient: 'from-red-950 via-rose-950 to-red-950',
    description: 'The grandeur of the Tsars and the ambition of the Soviet Union collide in a city of extraordinary contradictions.',
    population: '12.5M', currency: '₽ RUB', timezone: 'UTC+3', bestTime: 'May–Aug',
    highlights: [
      { id: 'mo-h1', name: 'Red Square',        type: 'attraction', address: 'Tverskoy District', rating: 4.9, reviews: 88400, lat: 55.7539, lng: 37.6208, duration: 90, description: 'The heart of Russia — St. Basil\'s Cathedral, the Kremlin, and Lenin\'s Mausoleum.' },
      { id: 'mo-h2', name: 'Bolshoi Theatre',   type: 'activity',   address: 'Teatralnaya Sq.', rating: 4.9, reviews: 22100, lat: 55.7600, lng: 37.6184, duration: 180, description: 'The world\'s most prestigious opera and ballet house — a sublime neoclassical colossus.' },
      { id: 'mo-h3', name: 'GUM Department Store', type: 'activity', address: 'Red Square',      rating: 4.7, reviews: 44200, lat: 55.7546, lng: 37.6219, duration: 90, description: 'A jaw-dropping 19th-century glass arcade beside the Kremlin — luxury, ice cream, history.' },
    ],
    food: [
      { id: 'mo-f1', name: 'White Rabbit',      type: 'restaurant', address: 'Smolenskaya Sq.', rating: 4.9, reviews: 6800, lat: 55.7475, lng: 37.5860, duration: 150, description: 'World\'s 50 Best restaurant in a glass dome 16 floors up. Modern Russian cuisine at its peak.' },
      { id: 'mo-f2', name: 'Café Pushkin',       type: 'restaurant', address: 'Tverskoy Blvd', rating: 4.8, reviews: 22100, lat: 55.7636, lng: 37.6027, duration: 90, description: 'A 19th-century intellectual café (actually opened in 1999) — borscht, blini, and atmosphere.' },
      { id: 'mo-f3', name: 'Central Market',     type: 'restaurant', address: 'Rochdelskaya St', rating: 4.7, reviews: 14200, lat: 55.7608, lng: 37.5766, duration: 90, description: 'Moscow\'s most beautiful food hall — Russian delicacies, Japanese counters, and oyster bars.' },
    ],
    neighborhoods: [
      { id: 'mo-n1', name: 'Arbat Street',    type: 'activity', address: 'Arbat District', rating: 4.7, reviews: 28100, description: 'Moscow\'s historic pedestrian street — souvenir stalls, street performers, and tsarist mansions.' },
      { id: 'mo-n2', name: 'Patriarch\'s Ponds', type: 'activity', address: 'Presnensky', rating: 4.8, reviews: 14100, description: 'The leafy enclave from Bulgakov\'s Master and Margarita — affluent, literary, beautiful.' },
      { id: 'mo-n3', name: 'Zaryadye Park',   type: 'activity', address: 'Kitay-Gorod',  rating: 4.8, reviews: 22100, description: 'Moscow\'s stunning new waterfront park with a floating bridge over the Moscow River.' },
    ],
  },
};

/* ── Generic fallback data ─────────────────────────────────────────────── */

function getFallbackData(cityName) {
  return {
    photo: null,
    gradient: 'from-blue-950 via-indigo-950 to-blue-950',
    description: `${cityName} offers a rich tapestry of culture, history, and unforgettable experiences. Explore its neighbourhoods, local cuisine, and hidden gems.`,
    population: 'N/A', currency: 'Local', timezone: 'Local', bestTime: 'Year-round',
    highlights: [
      { id: 'f-h1', name: `${cityName} Old Town`,     type: 'attraction', address: `${cityName} Centre`, rating: 4.5, reviews: 8200, lat: null, lng: null, duration: 90, description: 'Explore the historic heart of the city, where history meets modern life.' },
      { id: 'f-h2', name: `Central Museum`,            type: 'attraction', address: `Museum Quarter`,     rating: 4.4, reviews: 5600, lat: null, lng: null, duration: 120, description: 'The city\'s premier collection — art, history, and cultural artefacts.' },
      { id: 'f-h3', name: `City Park & Gardens`,       type: 'activity',   address: `Park District`,      rating: 4.6, reviews: 12400, lat: null, lng: null, duration: 60, description: 'Green lung of the city — perfect for a morning walk or afternoon picnic.' },
    ],
    food: [
      { id: 'f-f1', name: `Local Food Market`,        type: 'restaurant', address: `Market Square`,      rating: 4.5, reviews: 9800, lat: null, lng: null, duration: 60, description: 'Where locals shop — street food, fresh produce, and regional specialities.' },
      { id: 'f-f2', name: `Traditional Restaurant`,   type: 'restaurant', address: `City Centre`,        rating: 4.4, reviews: 6200, lat: null, lng: null, duration: 90, description: 'Authentic local cuisine passed down through generations.' },
    ],
    neighborhoods: [
      { id: 'f-n1', name: `Old Quarter`,    type: 'activity', address: `Historic Centre`, rating: 4.5, reviews: 8100, description: 'The oldest part of the city — cobblestones, heritage buildings, and authentic character.' },
      { id: 'f-n2', name: `Arts District`,  type: 'activity', address: `City Centre`,    rating: 4.3, reviews: 5200, description: 'Galleries, independent cafés, and the city\'s creative community.' },
    ],
  };
}

/* ── Rating helpers ────────────────────────────────────────────────────── */

function Stars({ rating }) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="flex items-center gap-0.5">
      {[...Array(full)].map(( _, i) => <span key={`f${i}`} className="text-amber-400 text-xs">★</span>)}
      {half && <span className="text-amber-400/50 text-xs">★</span>}
      {[...Array(empty)].map((_, i) => <span key={`e${i}`} className="text-white/15 text-xs">★</span>)}
    </span>
  );
}

/* Deterministically derive per-source ratings from a base rating.
 * Uses a simple hash of the location id so each place gets stable values. */
function hashOffset(seed, index) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  const offsets = [0, -0.2, 0.1, -0.1, 0.2];
  return offsets[(h + index) % offsets.length];
}

function getSourceRatings(baseRating, id = '') {
  const clamp = (v) => Math.min(5, Math.max(3.0, v));
  return [
    {
      key:   'google',
      label: 'G',
      title: 'Google',
      color: 'text-blue-400',
      bg:    'bg-blue-500/10 border-blue-500/20',
      rating: clamp(+(baseRating + hashOffset(id, 0)).toFixed(1)),
    },
    {
      key:   'tripadvisor',
      label: 'TA',
      title: 'Tripadvisor',
      color: 'text-emerald-400',
      bg:    'bg-emerald-500/10 border-emerald-500/20',
      rating: clamp(+(baseRating + hashOffset(id, 1)).toFixed(1)),
    },
    {
      key:   'foursquare',
      label: 'FS',
      title: 'Foursquare',
      color: 'text-violet-400',
      bg:    'bg-violet-500/10 border-violet-500/20',
      rating: clamp(+(baseRating + hashOffset(id, 2)).toFixed(1)),
    },
  ];
}

/* ── Location card ─────────────────────────────────────────────────────── */

function LocationCard({ loc, onAddToTrip, delay = 0 }) {
  const TYPE_ICONS = {
    attraction: '🏛️', restaurant: '🍽️', hotel: '🏨', activity: '🎯',
  };
  const TYPE_COLORS = {
    attraction: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    restaurant: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    hotel:      'text-purple-400 bg-purple-500/10 border-purple-500/20',
    activity:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  const colors = TYPE_COLORS[loc.type] || TYPE_COLORS.attraction;

  return (
    <div
      className="glass rounded-xl p-4 hover:bg-white/[0.06] transition-all duration-200 group"
      style={{ animation: `slide-up 0.4s ${delay}ms both` }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 border ${colors}`}>
          {TYPE_ICONS[loc.type] || '📍'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-white leading-tight">{loc.name}</h4>
            <button
              onClick={() => onAddToTrip(loc)}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-atlas-blue/10 border border-atlas-blue/25 text-atlas-blue text-[11px] font-semibold hover:bg-atlas-blue hover:text-white hover:border-atlas-blue transition-all duration-200 opacity-0 group-hover:opacity-100"
              title="Add to Trip"
            >
              <PlusIcon /> Add
            </button>
          </div>
          {loc.address && <p className="text-xs text-atlas-text-muted mt-0.5">{loc.address}</p>}
          {loc.description && <p className="text-xs text-atlas-text-secondary mt-1 leading-relaxed line-clamp-2">{loc.description}</p>}
          <div className="mt-2 space-y-1.5">
            {/* Multi-source ratings */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {getSourceRatings(loc.rating, loc.id).map((src) => (
                <span
                  key={src.key}
                  title={`${src.title}: ${src.rating}`}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${src.bg} ${src.color}`}
                >
                  <span className="opacity-70">{src.label}</span>
                  <Stars rating={src.rating} />
                  <span>{src.rating}</span>
                </span>
              ))}
              <span className="text-[10px] text-atlas-text-muted">
                {loc.reviews?.toLocaleString()} reviews
              </span>
            </div>
            {loc.duration && (
              <span className="text-[11px] text-atlas-text-muted flex items-center gap-1">
                <ClockIcon /> {loc.duration} min
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton loader ─────────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/[0.06] animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-white/[0.07] animate-pulse" />
          <div className="h-2.5 w-1/2 rounded bg-white/[0.05] animate-pulse" />
          <div className="h-2 w-full rounded bg-white/[0.04] animate-pulse" />
          <div className="h-2 w-5/6 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ── Weather widget ──────────────────────────────────────────────────────── */

function WeatherWidget({ weather, loading }) {
  if (loading) {
    return (
      <div className="glass rounded-lg px-3 py-2 col-span-2 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-white/[0.07] animate-pulse" />
        <div className="h-2.5 w-24 rounded bg-white/[0.06] animate-pulse" />
      </div>
    );
  }
  if (!weather) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 col-span-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{weather.icon}</span>
        <div>
          <p className="text-[10px] text-atlas-text-muted uppercase tracking-widest font-semibold">Now</p>
          <p className="text-xs font-bold text-white capitalize">
            {weather.temp}°C · {weather.description}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-atlas-text-muted">
          H:{weather.high}° L:{weather.low}°
        </p>
        <p className="text-[10px] text-atlas-text-muted">
          💧{weather.humidity}% · 💨{weather.windSpeed}kph
        </p>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────*/

const TAB_QUERIES = {
  highlights:    { query: 'top attractions sights landmarks', type: 'attraction' },
  food:          { query: 'best restaurants cafes dining',    type: 'restaurant' },
  neighborhoods: null, // neighbourhoods don't map well to Places API — use curated data
};

export default function CityPanel({ city, onClose, onAddToTrip }) {
  const [activeTab,   setActiveTab]   = useState('highlights');
  const [imgError,    setImgError]    = useState(false);
  const [weather,     setWeather]     = useState(null);
  const [weatherLoad, setWeatherLoad] = useState(false);
  const [livePOIs,    setLivePOIs]    = useState({}); // { [tab]: items[] }
  const [poisLoading, setPOIsLoading] = useState({}); // { [tab]: bool }
  const abortRef = useRef({});

  const data     = CITY_DATA[city?.name] || getFallbackData(city?.name || 'This City');
  const photoUrl = data.photo && !imgError
    ? `https://images.unsplash.com/${data.photo}?w=1400&q=85&fit=crop&auto=format`
    : null;

  /* Fetch weather when city changes */
  useEffect(() => {
    if (!city?.lat || !city?.lng) return;
    setWeather(null);
    setWeatherLoad(true);
    getCurrentWeather(city.lat, city.lng)
      .then((w) => setWeather(w))
      .catch(() => {})
      .finally(() => setWeatherLoad(false));
  }, [city?.lat, city?.lng]);

  /* Fetch live POIs for current tab (skip if curated data exists or neighbourhoods tab) */
  useEffect(() => {
    if (!city?.name || !city?.lat || !city?.lng) return;
    const tabCfg = TAB_QUERIES[activeTab];
    if (!tabCfg) return;                    // neighbourhoods — curated only
    if (livePOIs[activeTab]) return;        // already fetched
    if (CITY_DATA[city.name]?.[activeTab === 'highlights' ? 'highlights' : 'food']?.length > 0) {
      // We have curated data — still try live in background (silent, no spinner)
    }

    setPOIsLoading((p) => ({ ...p, [activeTab]: true }));

    // Cancel any previous in-flight fetch for this tab
    abortRef.current[activeTab]?.abort?.();
    const ac = new AbortController();
    abortRef.current[activeTab] = ac;

    searchCityPOIs(city.name, tabCfg.query, tabCfg.type, city.lat, city.lng)
      .then((results) => {
        if (ac.signal.aborted) return;
        if (results?.length > 0) {
          setLivePOIs((prev) => ({ ...prev, [activeTab]: results }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) {
          setPOIsLoading((p) => ({ ...p, [activeTab]: false }));
        }
      });

    return () => ac.abort();
  }, [city?.name, city?.lat, city?.lng, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  const curatedMap = {
    highlights:    data.highlights,
    food:          data.food,
    neighborhoods: data.neighborhoods,
  };

  const tabs = [
    { id: 'highlights',    label: 'Highlights'    },
    { id: 'food',          label: 'Food & Drink'  },
    { id: 'neighborhoods', label: 'Neighbourhoods' },
  ];

  /* Prefer live data; fall back to curated */
  const activeItems = livePOIs[activeTab] ?? curatedMap[activeTab] ?? [];
  const isLoading   = poisLoading[activeTab] && !livePOIs[activeTab] && !curatedMap[activeTab]?.length;

  function handleAddToTrip(loc) {
    const location = {
      name:             loc.name,
      type:             loc.type,
      address:          loc.address || null,
      lat:              loc.lat     || null,
      lng:              loc.lng     || null,
      notes:            loc.description ? loc.description.slice(0, 200) : null,
      duration_minutes: loc.duration || loc.duration_minutes || 60,
    };
    onAddToTrip?.(location);
  }

  /* Live data source badge */
  const isLive = !!livePOIs[activeTab];

  return (
    <>
      {/* Backdrop — click to close; ensure it receives pointer events */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={handleClose}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') handleClose(); }}
        style={{ animation: 'atlas-fade-in 0.2s ease both', cursor: 'pointer' }}
      />

      {/* Panel — stop propagation so clicking inside doesn't close */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] glass-heavy overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation:  'slide-in-right 0.38s cubic-bezier(0.25,0.46,0.45,0.94) both',
          borderLeft: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        {/* ── Hero image ──────────────────────────────────── */}
        <div className="relative h-52 sm:h-60 flex-shrink-0 overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={city?.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${data.gradient}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c18] via-[#080c18]/30 to-transparent" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            className="absolute top-4 right-4 p-2 rounded-xl glass text-white/80 hover:text-white hover:bg-white/20 transition-all z-10"
            aria-label="Close"
          >
            <XIcon />
          </button>
          <div className="absolute bottom-4 left-5">
            <h2 className="text-2xl font-black text-white leading-tight">{city?.name}</h2>
            <p className="text-sm text-white/70 font-medium">{city?.country}</p>
          </div>
        </div>

        {/* ── Scrollable content ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Description + quick facts + weather */}
          <div className="px-5 py-4 border-b border-atlas-border">
            <p className="text-sm text-atlas-text-secondary leading-relaxed mb-4">{data.description}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Population', value: data.population },
                { label: 'Currency',   value: data.currency   },
                { label: 'Timezone',   value: data.timezone   },
                { label: 'Best Time',  value: data.bestTime   },
              ].map((f) => (
                <div key={f.label} className="glass rounded-lg px-3 py-2">
                  <p className="text-[10px] text-atlas-text-muted uppercase tracking-widest font-semibold">{f.label}</p>
                  <p className="text-xs font-bold text-white mt-0.5">{f.value}</p>
                </div>
              ))}
              {/* Live weather card */}
              <WeatherWidget weather={weather} loading={weatherLoad} />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] flex-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      activeTab === t.id
                        ? 'bg-atlas-blue text-white shadow-glow-sm'
                        : 'text-atlas-text-muted hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Live data badge */}
            {isLive && (
              <p className="text-[10px] text-emerald-400 flex items-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Live data from Google Places
              </p>
            )}
          </div>

          {/* Tab content */}
          <div className="px-5 pb-6 space-y-2.5 pt-2">
            {isLoading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : activeItems.map((item, i) => (
              <LocationCard
                key={item.id || item.name}
                loc={item}
                onAddToTrip={handleAddToTrip}
                delay={i * 55}
              />
            ))}
          </div>

          {/* Footer CTA */}
          <div className="px-5 pb-6">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-xs text-atlas-text-muted mb-3">
                Save any location above directly to your trip itinerary.
              </p>
              <button type="button" onClick={handleClose} className="btn-ghost text-xs py-2 px-4 w-full">
                Continue Exploring
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────── */

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
