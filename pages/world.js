/**
 * pages/world.js — World Explorer
 * Amplified globe: 103 cities, live Geoapify Places, continent filters, modes, fly-to.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import CityPanel         from '../components/CityPanel';
import AddToTripModal    from '../components/AddToTripModal';
import GlobeErrorBoundary from '../components/GlobeErrorBoundary';

const WorldGlobe = dynamic(() => import('../components/WorldGlobe'), { ssr: false });

/* ══════════════════════════════════════════════════════
   City data
   ══════════════════════════════════════════════════════ */
const CITIES = [
  // Asia
  { lat:35.6762,lng:139.6503,label:'Tokyo',country:'Japan',continent:'Asia',color:'#3B82F6',timezone:'Asia/Tokyo',currency:'JPY',language:'Japanese',population:'13.9M',costLevel:3,climate:'temperate',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Shibuya Crossing','Senso-ji','Shinjuku'],cuisine:['Ramen','Sushi','Yakitori'],tip:'Get a Suica card for seamless transit.' },
  { lat:39.9042,lng:116.4074,label:'Beijing',country:'China',continent:'Asia',color:'#EF4444',timezone:'Asia/Shanghai',currency:'CNY',language:'Mandarin',population:'21.5M',costLevel:2,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Great Wall','Forbidden City','Temple of Heaven'],cuisine:['Peking Duck','Dumplings','Hot Pot'],tip:'Book Great Wall at Mutianyu to avoid crowds.' },
  { lat:31.2304,lng:121.4737,label:'Shanghai',country:'China',continent:'Asia',color:'#F59E0B',timezone:'Asia/Shanghai',currency:'CNY',language:'Mandarin',population:'26.3M',costLevel:2,climate:'subtropical',bestMonths:['Apr','May','Sep','Oct'],highlights:['The Bund','Yu Garden','Xintiandi'],cuisine:['Xiaolongbao','Shengjianbao','Hairy Crab'],tip:'The Bund at night is spectacular.' },
  { lat:1.3521,lng:103.8198,label:'Singapore',country:'Singapore',continent:'Asia',color:'#EC4899',timezone:'Asia/Singapore',currency:'SGD',language:'English',population:'5.9M',costLevel:4,climate:'tropical',bestMonths:['Feb','Mar','Jul','Aug'],highlights:['Gardens by the Bay','Marina Bay Sands','Hawker Centres'],cuisine:['Laksa','Hainanese Chicken','Chilli Crab'],tip:'Hawker centres offer the best value meals.' },
  { lat:13.7563,lng:100.5018,label:'Bangkok',country:'Thailand',continent:'Asia',color:'#8B5CF6',timezone:'Asia/Bangkok',currency:'THB',language:'Thai',population:'10.7M',costLevel:1,climate:'tropical',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Grand Palace','Wat Pho','Chatuchak Market'],cuisine:['Pad Thai','Tom Yum','Mango Sticky Rice'],tip:'Negotiate tuk-tuk prices before getting in.' },
  { lat:25.2048,lng:55.2708,label:'Dubai',country:'UAE',continent:'Asia',color:'#06B6D4',timezone:'Asia/Dubai',currency:'AED',language:'Arabic',population:'3.4M',costLevel:4,climate:'arid',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Burj Khalifa','Dubai Mall','Desert Safari'],cuisine:['Shawarma','Al Harees','Luqaimat'],tip:'Visit the observation deck at dusk.' },
  { lat:19.0760,lng:72.8777,label:'Mumbai',country:'India',continent:'Asia',color:'#F59E0B',timezone:'Asia/Kolkata',currency:'INR',language:'Hindi',population:'20.7M',costLevel:1,climate:'tropical',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Gateway of India','Marine Drive','Dharavi'],cuisine:['Vada Pav','Pav Bhaji','Biryani'],tip:'Avoid monsoon (Jun–Sep) for outdoor sightseeing.' },
  { lat:41.0082,lng:28.9784,label:'Istanbul',country:'Turkey',continent:'Asia',color:'#10B981',timezone:'Europe/Istanbul',currency:'TRY',language:'Turkish',population:'15.5M',costLevel:2,climate:'mediterranean',bestMonths:['Apr','May','Sep','Oct'],highlights:['Hagia Sophia','Grand Bazaar','Bosphorus'],cuisine:['Kebab','Baklava','Meze'],tip:'Cross the Bosphorus by ferry for city views.' },
  { lat:22.3193,lng:114.1694,label:'Hong Kong',country:'China',continent:'Asia',color:'#EC4899',timezone:'Asia/Hong_Kong',currency:'HKD',language:'Cantonese',population:'7.4M',costLevel:4,climate:'subtropical',bestMonths:['Oct','Nov','Dec','Jan'],highlights:['Victoria Peak','Temple Street Night Market','Lantau'],cuisine:['Dim Sum','Wonton Noodles','Egg Tarts'],tip:'Take the Star Ferry at night for harbour views.' },
  { lat:37.5665,lng:126.9780,label:'Seoul',country:'South Korea',continent:'Asia',color:'#3B82F6',timezone:'Asia/Seoul',currency:'KRW',language:'Korean',population:'9.7M',costLevel:2,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Gyeongbokgung','Bukchon Hanok Village','Namsan Tower'],cuisine:['Korean BBQ','Bibimbap','Tteokbokki'],tip:'Download Kakao Maps — better than Google for Seoul.' },
  { lat:-8.4095,lng:115.1889,label:'Bali',country:'Indonesia',continent:'Asia',color:'#10B981',timezone:'Asia/Makassar',currency:'IDR',language:'Indonesian',population:'4.2M',costLevel:1,climate:'tropical',bestMonths:['Apr','May','Jun','Sep'],highlights:['Uluwatu Temple','Tegallalang Terraces','Seminyak'],cuisine:['Nasi Goreng','Satay','Babi Guling'],tip:'Rent a scooter to explore the interior.' },
  { lat:35.0116,lng:135.7681,label:'Kyoto',country:'Japan',continent:'Asia',color:'#8B5CF6',timezone:'Asia/Tokyo',currency:'JPY',language:'Japanese',population:'1.5M',costLevel:3,climate:'temperate',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Fushimi Inari','Arashiyama Bamboo','Kinkaku-ji'],cuisine:['Kaiseki','Tofu Cuisine','Matcha Sweets'],tip:'Rent a bike — Kyoto\'s flat streets are perfect.' },
  { lat:34.6937,lng:135.5023,label:'Osaka',country:'Japan',continent:'Asia',color:'#F59E0B',timezone:'Asia/Tokyo',currency:'JPY',language:'Japanese',population:'2.7M',costLevel:3,climate:'temperate',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Dotonbori','Osaka Castle','Kuromon Market'],cuisine:['Takoyaki','Okonomiyaki','Kushikatsu'],tip:'Osaka is Japan\'s food capital — eat everything.' },
  { lat:25.0330,lng:121.5654,label:'Taipei',country:'Taiwan',continent:'Asia',color:'#06B6D4',timezone:'Asia/Taipei',currency:'TWD',language:'Mandarin',population:'2.7M',costLevel:2,climate:'subtropical',bestMonths:['Oct','Nov','Dec','Mar'],highlights:['Taipei 101','Jiufen Old Street','Shilin Night Market'],cuisine:['Beef Noodle Soup','Scallion Pancakes','Bubble Tea'],tip:'Night markets open after 6pm — that\'s the real Taipei.' },
  { lat:27.7172,lng:85.3240,label:'Kathmandu',country:'Nepal',continent:'Asia',color:'#EF4444',timezone:'Asia/Kathmandu',currency:'NPR',language:'Nepali',population:'1.5M',costLevel:1,climate:'highland',bestMonths:['Oct','Nov','Mar','Apr'],highlights:['Swayambhunath','Pashupatinath','Durbar Square'],cuisine:['Dal Bhat','Momo','Thukpa'],tip:'Acclimatise a day before trekking higher.' },
  { lat:21.0278,lng:105.8342,label:'Hanoi',country:'Vietnam',continent:'Asia',color:'#10B981',timezone:'Asia/Ho_Chi_Minh',currency:'VND',language:'Vietnamese',population:'8.1M',costLevel:1,climate:'subtropical',bestMonths:['Oct','Nov','Dec','Mar'],highlights:['Hoan Kiem Lake','Old Quarter','Temple of Literature'],cuisine:['Pho','Bun Cha','Banh Mi'],tip:'Explore the Old Quarter on foot in the morning.' },
  { lat:10.8231,lng:106.6297,label:'Ho Chi Minh',country:'Vietnam',continent:'Asia',color:'#F59E0B',timezone:'Asia/Ho_Chi_Minh',currency:'VND',language:'Vietnamese',population:'9M',costLevel:1,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['War Remnants Museum','Ben Thanh Market','Cu Chi Tunnels'],cuisine:['Banh Mi','Com Tam','Hu Tieu'],tip:'Grab Bike (motorbike taxi) is fastest way around.' },
  { lat:18.7883,lng:98.9853,label:'Chiang Mai',country:'Thailand',continent:'Asia',color:'#8B5CF6',timezone:'Asia/Bangkok',currency:'THB',language:'Thai',population:'1.1M',costLevel:1,climate:'tropical',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Doi Inthanon','Elephant Sanctuary','Night Bazaar'],cuisine:['Khao Soi','Sai Ua','Nam Prik Noom'],tip:'Visit the Saturday Walking Street for crafts.' },
  { lat:3.1390,lng:101.6869,label:'Kuala Lumpur',country:'Malaysia',continent:'Asia',color:'#3B82F6',timezone:'Asia/Kuala_Lumpur',currency:'MYR',language:'Malay',population:'8.6M',costLevel:2,climate:'tropical',bestMonths:['May','Jun','Jul','Aug'],highlights:['Petronas Towers','Batu Caves','Central Market'],cuisine:['Nasi Lemak','Char Kway Teow','Roti Canai'],tip:'Free KL Hop-On Hop-Off bus runs on weekends.' },
  { lat:14.5995,lng:120.9842,label:'Manila',country:'Philippines',continent:'Asia',color:'#EC4899',timezone:'Asia/Manila',currency:'PHP',language:'Filipino',population:'13.9M',costLevel:1,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Intramuros','Rizal Park','BGC'],cuisine:['Adobo','Sinigang','Lechon'],tip:'Day-trip to Tagaytay for cool air and volcano views.' },
  { lat:41.6938,lng:44.8015,label:'Tbilisi',country:'Georgia',continent:'Asia',color:'#06B6D4',timezone:'Asia/Tbilisi',currency:'GEL',language:'Georgian',population:'1.1M',costLevel:1,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Old Town','Narikala Fortress','Sulfur Baths'],cuisine:['Khinkali','Khachapuri','Churchkhela'],tip:'Georgian wine is outstanding — try a qvevri winery.' },
  { lat:39.6547,lng:66.9758,label:'Samarkand',country:'Uzbekistan',continent:'Asia',color:'#F59E0B',timezone:'Asia/Tashkent',currency:'UZS',language:'Uzbek',population:'0.5M',costLevel:1,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Registan','Shah-i-Zinda','Bibi-Khanym'],cuisine:['Plov','Samsa','Shashlik'],tip:'Registan at dusk glows gold — stay past sunset.' },
  { lat:4.1755,lng:73.5093,label:'Malé',country:'Maldives',continent:'Asia',color:'#10B981',timezone:'Indian/Maldives',currency:'MVR',language:'Dhivehi',population:'0.2M',costLevel:5,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Overwater Bungalows','Coral Reefs','Hulhumalé'],cuisine:['Mas Huni','Garudhiya','Hedhikaa'],tip:'Book overwater bungalows 6+ months ahead.' },
  { lat:6.9271,lng:79.8612,label:'Colombo',country:'Sri Lanka',continent:'Asia',color:'#EF4444',timezone:'Asia/Colombo',currency:'LKR',language:'Sinhala',population:'0.7M',costLevel:1,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Galle Face Green','National Museum','Pettah Market'],cuisine:['Kottu','Hoppers','Rice & Curry'],tip:'A tuk-tuk tour of Pettah market is unforgettable.' },

  // Europe
  { lat:48.8566,lng:2.3522,label:'Paris',country:'France',continent:'Europe',color:'#8B5CF6',timezone:'Europe/Paris',currency:'EUR',language:'French',population:'2.1M',costLevel:4,climate:'temperate',bestMonths:['Apr','May','Jun','Sep'],highlights:['Eiffel Tower','Louvre','Montmartre'],cuisine:['Croissant','Croque-Monsieur','Steak Frites'],tip:'Book Louvre tickets online to skip the queue.' },
  { lat:51.5074,lng:-0.1278,label:'London',country:'UK',continent:'Europe',color:'#F59E0B',timezone:'Europe/London',currency:'GBP',language:'English',population:'9M',costLevel:5,climate:'temperate',bestMonths:['May','Jun','Jul','Aug'],highlights:['Tower of London','British Museum','Borough Market'],cuisine:['Fish & Chips','Sunday Roast','Tikka Masala'],tip:'Most major museums are free — plan accordingly.' },
  { lat:41.9028,lng:12.4964,label:'Rome',country:'Italy',continent:'Europe',color:'#EF4444',timezone:'Europe/Rome',currency:'EUR',language:'Italian',population:'2.9M',costLevel:3,climate:'mediterranean',bestMonths:['Apr','May','Sep','Oct'],highlights:['Colosseum','Vatican','Trevi Fountain'],cuisine:['Carbonara','Supplì','Cacio e Pepe'],tip:'Book Colosseum tickets weeks ahead in peak season.' },
  { lat:41.3851,lng:2.1734,label:'Barcelona',country:'Spain',continent:'Europe',color:'#10B981',timezone:'Europe/Madrid',currency:'EUR',language:'Spanish',population:'1.6M',costLevel:3,climate:'mediterranean',bestMonths:['May','Jun','Sep','Oct'],highlights:['Sagrada Família','Park Güell','Las Ramblas'],cuisine:['Paella','Jamón','Patatas Bravas'],tip:'Sagrada Família at sunrise is magical and less crowded.' },
  { lat:52.3676,lng:4.9041,label:'Amsterdam',country:'Netherlands',continent:'Europe',color:'#06B6D4',timezone:'Europe/Amsterdam',currency:'EUR',language:'Dutch',population:'0.9M',costLevel:4,climate:'temperate',bestMonths:['Apr','May','Jun','Sep'],highlights:['Rijksmuseum','Anne Frank House','Canal Cruises'],cuisine:['Stroopwafel','Bitterballen','Dutch Cheese'],tip:'Rent a bike — faster and more authentic than taxis.' },
  { lat:50.0755,lng:14.4378,label:'Prague',country:'Czechia',continent:'Europe',color:'#8B5CF6',timezone:'Europe/Prague',currency:'CZK',language:'Czech',population:'1.3M',costLevel:2,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Prague Castle','Charles Bridge','Old Town Square'],cuisine:['Svíčková','Trdelník','Czech Beer'],tip:'Cross Charles Bridge just after dawn — no crowds.' },
  { lat:48.2082,lng:16.3738,label:'Vienna',country:'Austria',continent:'Europe',color:'#F59E0B',timezone:'Europe/Vienna',currency:'EUR',language:'German',population:'1.9M',costLevel:3,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Schönbrunn Palace','Belvedere','Naschmarkt'],cuisine:['Wiener Schnitzel','Sachertorte','Apfelstrudel'],tip:'The Vienna Card gives unlimited transit + museum discounts.' },
  { lat:52.5200,lng:13.4050,label:'Berlin',country:'Germany',continent:'Europe',color:'#3B82F6',timezone:'Europe/Berlin',currency:'EUR',language:'German',population:'3.7M',costLevel:2,climate:'continental',bestMonths:['May','Jun','Jul','Aug'],highlights:['Brandenburg Gate','East Side Gallery','Pergamon'],cuisine:['Currywurst','Döner Kebab','Pretzels'],tip:'Berlin\'s nightlife doesn\'t start until after midnight.' },
  { lat:37.9838,lng:23.7275,label:'Athens',country:'Greece',continent:'Europe',color:'#06B6D4',timezone:'Europe/Athens',currency:'EUR',language:'Greek',population:'3.2M',costLevel:2,climate:'mediterranean',bestMonths:['Apr','May','Sep','Oct'],highlights:['Acropolis','Plaka','National Archaeological Museum'],cuisine:['Moussaka','Souvlaki','Spanakopita'],tip:'Visit Acropolis first thing in the morning in summer.' },
  { lat:38.7223,lng:-9.1393,label:'Lisbon',country:'Portugal',continent:'Europe',color:'#EF4444',timezone:'Europe/Lisbon',currency:'EUR',language:'Portuguese',population:'0.5M',costLevel:2,climate:'mediterranean',bestMonths:['Apr','May','Sep','Oct'],highlights:['Belém Tower','Alfama','Sintra'],cuisine:['Bacalhau','Pastéis de Nata','Bifanas'],tip:'Walk the Alfama hills instead of crowded Tram 28.' },
  { lat:55.9533,lng:-3.1883,label:'Edinburgh',country:'UK',continent:'Europe',color:'#8B5CF6',timezone:'Europe/London',currency:'GBP',language:'English',population:'0.5M',costLevel:3,climate:'temperate',bestMonths:['May','Jun','Jul','Aug'],highlights:['Edinburgh Castle','Royal Mile','Arthur\'s Seat'],cuisine:['Haggis','Scotch Whisky','Cranachan'],tip:'Climb Arthur\'s Seat at dawn for panoramic views.' },
  { lat:55.6761,lng:12.5683,label:'Copenhagen',country:'Denmark',continent:'Europe',color:'#10B981',timezone:'Europe/Copenhagen',currency:'DKK',language:'Danish',population:'0.8M',costLevel:5,climate:'temperate',bestMonths:['May','Jun','Jul','Aug'],highlights:['Nyhavn','Tivoli Gardens','The Little Mermaid'],cuisine:['Smørrebrød','Pastries','New Nordic'],tip:'Copenhagen is very bike-friendly — rent one day one.' },
  { lat:47.4979,lng:19.0402,label:'Budapest',country:'Hungary',continent:'Europe',color:'#F59E0B',timezone:'Europe/Budapest',currency:'HUF',language:'Hungarian',population:'1.8M',costLevel:2,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Parliament','Széchenyi Baths','Ruin Bars'],cuisine:['Goulash','Langos','Chimney Cake'],tip:'Thermal baths are best on a weekday morning.' },
  { lat:59.3293,lng:18.0686,label:'Stockholm',country:'Sweden',continent:'Europe',color:'#3B82F6',timezone:'Europe/Stockholm',currency:'SEK',language:'Swedish',population:'0.9M',costLevel:5,climate:'continental',bestMonths:['Jun','Jul','Aug'],highlights:['Vasa Museum','Gamla Stan','ABBA Museum'],cuisine:['Meatballs','Gravlax','Cinnamon Buns'],tip:'The archipelago is stunning in summer — take a boat.' },
  { lat:60.1699,lng:24.9384,label:'Helsinki',country:'Finland',continent:'Europe',color:'#06B6D4',timezone:'Europe/Helsinki',currency:'EUR',language:'Finnish',population:'0.7M',costLevel:4,climate:'continental',bestMonths:['Jun','Jul','Aug'],highlights:['Helsinki Cathedral','Suomenlinna','Design District'],cuisine:['Karjalanpiirakka','Salmon Soup','Salmiak'],tip:'Day trips for Northern Lights leave from Helsinki in winter.' },
  { lat:59.9139,lng:10.7522,label:'Oslo',country:'Norway',continent:'Europe',color:'#10B981',timezone:'Europe/Oslo',currency:'NOK',language:'Norwegian',population:'0.7M',costLevel:5,climate:'continental',bestMonths:['Jun','Jul','Aug'],highlights:['Vigeland Park','Viking Ship Museum','Munch Museum'],cuisine:['Rakfisk','Brunost','Fårikål'],tip:'Oslo Pass covers transit + museums — great value.' },
  { lat:42.6507,lng:18.0944,label:'Dubrovnik',country:'Croatia',continent:'Europe',color:'#EF4444',timezone:'Europe/Zagreb',currency:'EUR',language:'Croatian',population:'0.04M',costLevel:4,climate:'mediterranean',bestMonths:['May','Jun','Sep','Oct'],highlights:['City Walls','Old Town','Lokrum Island'],cuisine:['Peka','Black Risotto','Prstaci'],tip:'Walk the city walls at 8am before tour groups arrive.' },
  { lat:45.4408,lng:12.3155,label:'Venice',country:'Italy',continent:'Europe',color:'#8B5CF6',timezone:'Europe/Rome',currency:'EUR',language:'Italian',population:'0.25M',costLevel:5,climate:'temperate',bestMonths:['Apr','May','Sep','Oct'],highlights:['Grand Canal','St Mark\'s Basilica','Rialto Bridge'],cuisine:['Cicchetti','Bigoli','Sarde in Saor'],tip:'Get lost in the backstreets — that\'s the real Venice.' },
  { lat:43.7696,lng:11.2558,label:'Florence',country:'Italy',continent:'Europe',color:'#F59E0B',timezone:'Europe/Rome',currency:'EUR',language:'Italian',population:'0.4M',costLevel:3,climate:'mediterranean',bestMonths:['Apr','May','Sep','Oct'],highlights:['Uffizi Gallery','David (Accademia)','Ponte Vecchio'],cuisine:['Bistecca Fiorentina','Lampredotto','Gelato'],tip:'Pre-book Uffizi and Accademia — queues are brutal.' },
  { lat:41.1579,lng:-8.6291,label:'Porto',country:'Portugal',continent:'Europe',color:'#3B82F6',timezone:'Europe/Lisbon',currency:'EUR',language:'Portuguese',population:'0.2M',costLevel:2,climate:'mediterranean',bestMonths:['May','Jun','Sep','Oct'],highlights:['Ribeira','Livraria Lello','Douro Valley'],cuisine:['Francesinha','Port Wine','Tripas'],tip:'Cross the Dom Luís bridge for the best rooftop views.' },
  { lat:37.3886,lng:-5.9823,label:'Seville',country:'Spain',continent:'Europe',color:'#EF4444',timezone:'Europe/Madrid',currency:'EUR',language:'Spanish',population:'0.7M',costLevel:2,climate:'mediterranean',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Alcázar','Giralda','Triana'],cuisine:['Gazpacho','Salmorejo','Flamenquín'],tip:'Avoid July–August — Seville is the hottest city in Europe.' },
  { lat:50.8503,lng:4.3517,label:'Brussels',country:'Belgium',continent:'Europe',color:'#06B6D4',timezone:'Europe/Brussels',currency:'EUR',language:'French',population:'1.2M',costLevel:3,climate:'temperate',bestMonths:['Apr','May','Jun','Sep'],highlights:['Grand Place','Atomium','Manneken Pis'],cuisine:['Waffles','Moules-Frites','Belgian Beer'],tip:'Try a Belgian craft beer at a traditional estaminet.' },
  { lat:47.3769,lng:8.5417,label:'Zurich',country:'Switzerland',continent:'Europe',color:'#8B5CF6',timezone:'Europe/Zurich',currency:'CHF',language:'German',population:'0.4M',costLevel:5,climate:'continental',bestMonths:['May','Jun','Jul','Aug'],highlights:['Old Town','Lake Zurich','Kunsthaus'],cuisine:['Fondue','Rösti','Zürcher Geschnetzeltes'],tip:'Swiss Museum Pass covers most attractions country-wide.' },
  { lat:64.1466,lng:-21.9426,label:'Reykjavik',country:'Iceland',continent:'Europe',color:'#10B981',timezone:'Atlantic/Reykjavik',currency:'ISK',language:'Icelandic',population:'0.13M',costLevel:5,climate:'polar',bestMonths:['Jun','Jul','Aug'],highlights:['Northern Lights','Blue Lagoon','Golden Circle'],cuisine:['Skyr','Plokkfiskur','Lamb Soup'],tip:'Rent a campervan for the Ring Road in summer.' },
  { lat:52.2297,lng:21.0122,label:'Warsaw',country:'Poland',continent:'Europe',color:'#EF4444',timezone:'Europe/Warsaw',currency:'PLN',language:'Polish',population:'1.8M',costLevel:2,climate:'continental',bestMonths:['May','Jun','Sep','Oct'],highlights:['Old Town','POLIN Museum','Palace of Culture'],cuisine:['Pierogi','Żurek','Bigos'],tip:'Warsaw\'s Old Town was rebuilt from scratch — remarkable.' },
  { lat:50.0647,lng:19.9450,label:'Kraków',country:'Poland',continent:'Europe',color:'#3B82F6',timezone:'Europe/Warsaw',currency:'PLN',language:'Polish',population:'0.8M',costLevel:1,climate:'continental',bestMonths:['May','Jun','Sep','Oct'],highlights:['Wawel Castle','Kazimierz','Wieliczka Salt Mine'],cuisine:['Obwarzanek','Zapiekanka','Oscypek'],tip:'Day trip to the Wieliczka Salt Mine — stunning.' },
  { lat:59.4370,lng:24.7536,label:'Tallinn',country:'Estonia',continent:'Europe',color:'#F59E0B',timezone:'Europe/Tallinn',currency:'EUR',language:'Estonian',population:'0.45M',costLevel:2,climate:'continental',bestMonths:['May','Jun','Jul','Aug'],highlights:['Old Town','Toompea Castle','Kadriorg Park'],cuisine:['Leib','Black Bread','Verivorst'],tip:'Tallinn\'s medieval Old Town is UNESCO-listed and compact.' },
  { lat:56.9460,lng:24.1059,label:'Riga',country:'Latvia',continent:'Europe',color:'#8B5CF6',timezone:'Europe/Riga',currency:'EUR',language:'Latvian',population:'0.6M',costLevel:2,climate:'continental',bestMonths:['May','Jun','Jul','Aug'],highlights:['Art Nouveau District','Central Market','Old Town'],cuisine:['Grey Peas with Bacon','Rupjmaize','Kvass'],tip:'Riga has Europe\'s best Art Nouveau architecture.' },

  // Americas
  { lat:40.7128,lng:-74.0060,label:'New York',country:'USA',continent:'Americas',color:'#06B6D4',timezone:'America/New_York',currency:'USD',language:'English',population:'8.3M',costLevel:5,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['Central Park','MoMA','Brooklyn Bridge'],cuisine:['Bagels','NY Pizza','Deli Sandwiches'],tip:'Staten Island Ferry is free with great Statue of Liberty views.' },
  { lat:34.0522,lng:-118.2437,label:'Los Angeles',country:'USA',continent:'Americas',color:'#EF4444',timezone:'America/Los_Angeles',currency:'USD',language:'English',population:'3.9M',costLevel:4,climate:'mediterranean',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Griffith Observatory','Getty Center','Santa Monica'],cuisine:['Tacos','Korean BBQ','In-N-Out'],tip:'Rent a car — LA is impossible without one.' },
  { lat:37.7749,lng:-122.4194,label:'San Francisco',country:'USA',continent:'Americas',color:'#10B981',timezone:'America/Los_Angeles',currency:'USD',language:'English',population:'0.9M',costLevel:5,climate:'mediterranean',bestMonths:['Sep','Oct'],highlights:['Golden Gate','Alcatraz','Ferry Building'],cuisine:['Sourdough','Dim Sum','Burritos'],tip:'Fog rolls in daily in summer — warmest months are Sept/Oct.' },
  { lat:41.8781,lng:-87.6298,label:'Chicago',country:'USA',continent:'Americas',color:'#3B82F6',timezone:'America/Chicago',currency:'USD',language:'English',population:'2.7M',costLevel:3,climate:'continental',bestMonths:['May','Jun','Sep','Oct'],highlights:['Millennium Park','Art Institute','Navy Pier'],cuisine:['Deep Dish Pizza','Chicago Dogs','Italian Beef'],tip:'The "L" train is the best way to get around.' },
  { lat:25.7617,lng:-80.1918,label:'Miami',country:'USA',continent:'Americas',color:'#EC4899',timezone:'America/New_York',currency:'USD',language:'English',population:'0.5M',costLevel:4,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['South Beach','Wynwood Walls','Everglades'],cuisine:['Cuban Sandwich','Ceviche','Stone Crab'],tip:'Art Basel Miami Beach in December is unmissable.' },
  { lat:45.5017,lng:-73.5673,label:'Montreal',country:'Canada',continent:'Americas',color:'#8B5CF6',timezone:'America/Toronto',currency:'CAD',language:'French',population:'4.2M',costLevel:3,climate:'continental',bestMonths:['Jun','Jul','Aug'],highlights:['Old Montreal','Mount Royal','Jazz Festival'],cuisine:['Poutine','Bagels','Smoked Meat'],tip:'Montreal\'s underground city is a lifesaver in winter.' },
  { lat:49.2827,lng:-123.1207,label:'Vancouver',country:'Canada',continent:'Americas',color:'#10B981',timezone:'America/Vancouver',currency:'CAD',language:'English',population:'2.6M',costLevel:4,climate:'temperate',bestMonths:['Jun','Jul','Aug','Sep'],highlights:['Stanley Park','Granville Island','Whistler'],cuisine:['Pacific Salmon','Sushi','Dim Sum'],tip:'Stanley Park\'s seawall is 22km of stunning coastal cycling.' },
  { lat:43.6532,lng:-79.3832,label:'Toronto',country:'Canada',continent:'Americas',color:'#F59E0B',timezone:'America/Toronto',currency:'CAD',language:'English',population:'6.2M',costLevel:4,climate:'continental',bestMonths:['May','Jun','Sep','Oct'],highlights:['CN Tower','Kensington Market','Art Gallery of Ontario'],cuisine:['Peameal Bacon','Butter Tarts','Poutine'],tip:'Toronto has more restaurants per capita than NYC.' },
  { lat:19.4326,lng:-99.1332,label:'Mexico City',country:'Mexico',continent:'Americas',color:'#EF4444',timezone:'America/Mexico_City',currency:'MXN',language:'Spanish',population:'9.2M',costLevel:1,climate:'highland',bestMonths:['Mar','Apr','May','Oct'],highlights:['Teotihuacán','Frida Kahlo Museum','Zócalo'],cuisine:['Tacos de Canasta','Tamales','Pozole'],tip:'Altitude is 2,240m — take it easy the first day.' },
  { lat:21.1619,lng:-86.8515,label:'Cancún',country:'Mexico',continent:'Americas',color:'#06B6D4',timezone:'America/Cancun',currency:'MXN',language:'Spanish',population:'0.9M',costLevel:2,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Chichén Itzá','Tulum','Cenotes'],cuisine:['Cochinita Pibil','Pescado Tikin Xic','Salbutes'],tip:'Escape the hotel zone — the real culture is inland.' },
  { lat:-34.6037,lng:-58.3816,label:'Buenos Aires',country:'Argentina',continent:'Americas',color:'#3B82F6',timezone:'America/Argentina/Buenos_Aires',currency:'ARS',language:'Spanish',population:'3.1M',costLevel:1,climate:'temperate',bestMonths:['Oct','Nov','Mar','Apr'],highlights:['La Boca','Recoleta Cemetery','Palermo'],cuisine:['Asado','Empanadas','Medialunas'],tip:'Tango in Palermo Soho is more authentic than tourist shows.' },
  { lat:-22.9068,lng:-43.1729,label:'Rio de Janeiro',country:'Brazil',continent:'Americas',color:'#10B981',timezone:'America/Sao_Paulo',currency:'BRL',language:'Portuguese',population:'6.7M',costLevel:2,climate:'tropical',bestMonths:['May','Jun','Sep','Oct'],highlights:['Christ the Redeemer','Copacabana','Sugarloaf'],cuisine:['Churrasco','Açaí Bowl','Feijoada'],tip:'Carnival (Feb/Mar) needs 6-month advance booking.' },
  { lat:-12.0464,lng:-77.0428,label:'Lima',country:'Peru',continent:'Americas',color:'#EC4899',timezone:'America/Lima',currency:'PEN',language:'Spanish',population:'10.8M',costLevel:1,climate:'arid',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Larco Museum','Miraflores','Barranco'],cuisine:['Ceviche','Lomo Saltado','Anticuchos'],tip:'Lima has South America\'s best fine dining scene.' },
  { lat:4.7110,lng:-74.0721,label:'Bogotá',country:'Colombia',continent:'Americas',color:'#F59E0B',timezone:'America/Bogota',currency:'COP',language:'Spanish',population:'7.4M',costLevel:1,climate:'highland',bestMonths:['Dec','Jan','Feb','Jul'],highlights:['Gold Museum','La Candelaria','Monserrate'],cuisine:['Bandeja Paisa','Ajiaco','Changua'],tip:'Altitude is 2,640m — hydrate and rest on arrival.' },
  { lat:6.2442,lng:-75.5812,label:'Medellín',country:'Colombia',continent:'Americas',color:'#8B5CF6',timezone:'America/Bogota',currency:'COP',language:'Spanish',population:'2.5M',costLevel:1,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Metrocable','Parque Arví','Botanical Garden'],cuisine:['Bandeja Paisa','Arepa','Sancocho'],tip:'The commune cable cars show the city\'s transformation.' },
  { lat:-33.4489,lng:-70.6693,label:'Santiago',country:'Chile',continent:'Americas',color:'#3B82F6',timezone:'America/Santiago',currency:'CLP',language:'Spanish',population:'7M',costLevel:2,climate:'mediterranean',bestMonths:['Oct','Nov','Mar','Apr'],highlights:['Cerro San Cristóbal','Barrio Italia','Valparaíso'],cuisine:['Empanadas','Cazuela','Completos'],tip:'Day trip to Valparaíso for street art and ocean views.' },
  { lat:10.3997,lng:-75.5144,label:'Cartagena',country:'Colombia',continent:'Americas',color:'#EF4444',timezone:'America/Bogota',currency:'COP',language:'Spanish',population:'1.1M',costLevel:2,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Walled City','Rosario Islands','Getsemaní'],cuisine:['Arepa de Huevo','Seafood','Costeño Cheese'],tip:'Walk the walled city at dusk when the heat softens.' },
  { lat:23.1136,lng:-82.3666,label:'Havana',country:'Cuba',continent:'Americas',color:'#06B6D4',timezone:'America/Havana',currency:'CUP',language:'Spanish',population:'2.1M',costLevel:1,climate:'tropical',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Old Havana','Malecón','Classic Cars'],cuisine:['Ropa Vieja','Moros y Cristianos','Mojito'],tip:'Bring enough cash — card machines are very limited.' },
  { lat:-13.5320,lng:-71.9675,label:'Cusco',country:'Peru',continent:'Americas',color:'#F59E0B',timezone:'America/Lima',currency:'PEN',language:'Spanish',population:'0.4M',costLevel:1,climate:'highland',bestMonths:['May','Jun','Jul','Aug'],highlights:['Machu Picchu','Sacsayhuamán','Sacred Valley'],cuisine:['Cuy','Quinoa Soup','Chicha Morada'],tip:'Spend 2 days acclimatising before going to Machu Picchu.' },
  { lat:-0.2295,lng:-78.5243,label:'Quito',country:'Ecuador',continent:'Americas',color:'#10B981',timezone:'America/Guayaquil',currency:'USD',language:'Spanish',population:'2.1M',costLevel:1,climate:'highland',bestMonths:['Jun','Jul','Aug','Sep'],highlights:['Old Town','Mitad del Mundo','TelefériQo'],cuisine:['Locro de Papa','Seco de Pollo','Ceviche'],tip:'Quito has the best-preserved colonial centre in Latin America.' },
  { lat:-34.9011,lng:-56.1645,label:'Montevideo',country:'Uruguay',continent:'Americas',color:'#8B5CF6',timezone:'America/Montevideo',currency:'UYU',language:'Spanish',population:'1.4M',costLevel:2,climate:'temperate',bestMonths:['Dec','Jan','Feb','Mar'],highlights:['Old City','Rambla','Mercado del Puerto'],cuisine:['Asado','Chivito','Medio y Medio'],tip:'Uruguay\'s beachfront in summer rivals anywhere in South America.' },
  { lat:-23.5558,lng:-46.6396,label:'São Paulo',country:'Brazil',continent:'Americas',color:'#EF4444',timezone:'America/Sao_Paulo',currency:'BRL',language:'Portuguese',population:'12.3M',costLevel:2,climate:'subtropical',bestMonths:['Apr','May','Aug','Sep'],highlights:['MASP','Liberdade','Vila Madalena'],cuisine:['Coxinha','Pão de Queijo','Churrasco'],tip:'São Paulo\'s food scene is the best in South America.' },
  { lat:29.9511,lng:-90.0715,label:'New Orleans',country:'USA',continent:'Americas',color:'#06B6D4',timezone:'America/Chicago',currency:'USD',language:'English',population:'0.4M',costLevel:3,climate:'subtropical',bestMonths:['Oct','Nov','Mar','Apr'],highlights:['French Quarter','Garden District','Frenchmen St'],cuisine:['Gumbo','Beignets','Po\'boys'],tip:'Frenchmen Street has live jazz every night — no cover charge.' },
  { lat:36.1699,lng:-115.1398,label:'Las Vegas',country:'USA',continent:'Americas',color:'#EC4899',timezone:'America/Los_Angeles',currency:'USD',language:'English',population:'2.2M',costLevel:3,climate:'arid',bestMonths:['Oct','Nov','Mar','Apr'],highlights:['The Strip','Grand Canyon day trip','Fremont Street'],cuisine:['Buffets','Craft Cocktails','Celebrity Chef Restaurants'],tip:'Day trips to Zion, Bryce, or the Grand Canyon are stunning.' },
  { lat:47.6062,lng:-122.3321,label:'Seattle',country:'USA',continent:'Americas',color:'#10B981',timezone:'America/Los_Angeles',currency:'USD',language:'English',population:'0.7M',costLevel:4,climate:'temperate',bestMonths:['Jul','Aug','Sep'],highlights:['Space Needle','Pike Place Market','Mount Rainier'],cuisine:['Salmon','Coffee','Teriyaki'],tip:'Seattle summers are gorgeous — rain is mainly Oct–May.' },
  { lat:42.3601,lng:-71.0589,label:'Boston',country:'USA',continent:'Americas',color:'#3B82F6',timezone:'America/New_York',currency:'USD',language:'English',population:'0.7M',costLevel:4,climate:'continental',bestMonths:['May','Jun','Sep','Oct'],highlights:['Freedom Trail','Harvard','Fenway Park'],cuisine:['Clam Chowder','Lobster Roll','Cannoli'],tip:'Walk the Freedom Trail for a self-guided history lesson.' },
  { lat:38.9072,lng:-77.0369,label:'Washington DC',country:'USA',continent:'Americas',color:'#8B5CF6',timezone:'America/New_York',currency:'USD',language:'English',population:'0.7M',costLevel:3,climate:'continental',bestMonths:['Apr','May','Sep','Oct'],highlights:['National Mall','Smithsonian Museums','Lincoln Memorial'],cuisine:['Half-Smoke','Old Bay Crab','Ethiopian Food'],tip:'All Smithsonian museums are free — plan several days.' },

  // Africa
  { lat:30.0444,lng:31.2357,label:'Cairo',country:'Egypt',continent:'Africa',color:'#F59E0B',timezone:'Africa/Cairo',currency:'EGP',language:'Arabic',population:'21M',costLevel:1,climate:'arid',bestMonths:['Oct','Nov','Feb','Mar'],highlights:['Pyramids of Giza','Egyptian Museum','Khan el-Khalili'],cuisine:['Koshari','Ful Medames','Mahshi'],tip:'Visit the pyramids at dawn with a private guide.' },
  { lat:-33.9249,lng:18.4241,label:'Cape Town',country:'South Africa',continent:'Africa',color:'#10B981',timezone:'Africa/Johannesburg',currency:'ZAR',language:'Afrikaans',population:'4.6M',costLevel:2,climate:'mediterranean',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Table Mountain','Robben Island','Cape Point'],cuisine:['Braai','Bobotie','Boerewors'],tip:'Take the cable car up Table Mountain — views are 360°.' },
  { lat:31.6295,lng:-7.9811,label:'Marrakech',country:'Morocco',continent:'Africa',color:'#EF4444',timezone:'Africa/Casablanca',currency:'MAD',language:'Arabic',population:'1M',costLevel:1,climate:'arid',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Djemaa el-Fna','Bahia Palace','Souks'],cuisine:['Tagine','Couscous','Pastilla'],tip:'Bargain confidently — start at 25% of asking price.' },
  { lat:-1.2921,lng:36.8219,label:'Nairobi',country:'Kenya',continent:'Africa',color:'#3B82F6',timezone:'Africa/Nairobi',currency:'KES',language:'Swahili',population:'5M',costLevel:2,climate:'highland',bestMonths:['Jul','Aug','Jan','Feb'],highlights:['Masai Mara','Giraffe Centre','Karen Blixen Museum'],cuisine:['Nyama Choma','Ugali','Sukuma Wiki'],tip:'Book safari camps 6+ months ahead for the Great Migration.' },
  { lat:-6.1659,lng:39.2026,label:'Zanzibar',country:'Tanzania',continent:'Africa',color:'#06B6D4',timezone:'Africa/Dar_es_Salaam',currency:'TZS',language:'Swahili',population:'1.3M',costLevel:2,climate:'tropical',bestMonths:['Jun','Jul','Aug','Sep'],highlights:['Stone Town','Nungwi Beach','Spice Farms'],cuisine:['Zanzibar Pizza','Urojo','Pilau'],tip:'Stone Town\'s winding alleys are best explored with a guide.' },
  { lat:33.5731,lng:-7.5898,label:'Casablanca',country:'Morocco',continent:'Africa',color:'#8B5CF6',timezone:'Africa/Casablanca',currency:'MAD',language:'Arabic',population:'3.7M',costLevel:1,climate:'mediterranean',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Hassan II Mosque','Corniche','Art Deco Quarter'],cuisine:['Seafood','Harira','M\'hanncha'],tip:'Hassan II Mosque is Africa\'s largest — tours run daily.' },
  { lat:9.0320,lng:38.7469,label:'Addis Ababa',country:'Ethiopia',continent:'Africa',color:'#EF4444',timezone:'Africa/Addis_Ababa',currency:'ETB',language:'Amharic',population:'5M',costLevel:1,climate:'highland',bestMonths:['Oct','Nov','Jan','Feb'],highlights:['National Museum','Merkato','Entoto Hill'],cuisine:['Injera','Kitfo','Tej Honey Wine'],tip:'Ethiopian coffee ceremony is a must-experience cultural ritual.' },
  { lat:6.5244,lng:3.3792,label:'Lagos',country:'Nigeria',continent:'Africa',color:'#10B981',timezone:'Africa/Lagos',currency:'NGN',language:'English',population:'14.8M',costLevel:2,climate:'tropical',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Lekki Conservation Centre','National Museum','Tarkwa Bay'],cuisine:['Jollof Rice','Suya','Egusi Soup'],tip:'Traffic in Lagos is extreme — use boats where possible.' },
  { lat:14.7167,lng:-17.4677,label:'Dakar',country:'Senegal',continent:'Africa',color:'#F59E0B',timezone:'Africa/Dakar',currency:'XOF',language:'French',population:'3.7M',costLevel:1,climate:'tropical',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Gorée Island','African Renaissance Monument','Sandaga Market'],cuisine:['Thiéboudienne','Yassa','Thiakry'],tip:'Gorée Island is a powerful UNESCO site about the slave trade.' },
  { lat:-4.6796,lng:55.4920,label:'Victoria',country:'Seychelles',continent:'Africa',color:'#06B6D4',timezone:'Indian/Mahe',currency:'SCR',language:'Creole',population:'0.03M',costLevel:5,climate:'tropical',bestMonths:['Apr','May','Oct','Nov'],highlights:['Vallée de Mai','Anse Lazio','La Digue'],cuisine:['Grilled Fish','Creole Curry','Ladob'],tip:'La Digue is best reached by schooner and explored by bicycle.' },

  // Oceania
  { lat:-33.8688,lng:151.2093,label:'Sydney',country:'Australia',continent:'Oceania',color:'#3B82F6',timezone:'Australia/Sydney',currency:'AUD',language:'English',population:'5.3M',costLevel:4,climate:'temperate',bestMonths:['Sep','Oct','Nov','Mar'],highlights:['Sydney Opera House','Bondi Beach','Harbour Bridge'],cuisine:['Meat Pie','Tim Tams','Barramundi'],tip:'Climb the Harbour Bridge for a perspective you won\'t forget.' },
  { lat:-37.8136,lng:144.9631,label:'Melbourne',country:'Australia',continent:'Oceania',color:'#8B5CF6',timezone:'Australia/Melbourne',currency:'AUD',language:'English',population:'5.2M',costLevel:4,climate:'temperate',bestMonths:['Oct','Nov','Mar','Apr'],highlights:['Federation Square','Royal Botanic Gardens','Yarra Valley'],cuisine:['Coffee Culture','Smashed Avo','Vietnamese Pho'],tip:'Melbourne has the world\'s best coffee — start every day with one.' },
  { lat:-36.8485,lng:174.7633,label:'Auckland',country:'New Zealand',continent:'Oceania',color:'#10B981',timezone:'Pacific/Auckland',currency:'NZD',language:'English',population:'1.7M',costLevel:4,climate:'temperate',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Sky Tower','Waiheke Island','Rangitoto'],cuisine:['Hangi','Pavlova','Green-lipped Mussels'],tip:'Waiheke Island is a 35-minute ferry with incredible wineries.' },
  { lat:21.3069,lng:-157.8583,label:'Honolulu',country:'USA',continent:'Oceania',color:'#F59E0B',timezone:'Pacific/Honolulu',currency:'USD',language:'English',population:'0.35M',costLevel:4,climate:'tropical',bestMonths:['Apr','May','Sep','Oct'],highlights:['Waikiki','Diamond Head','Pearl Harbor'],cuisine:['Poke Bowl','Plate Lunch','Spam Musubi'],tip:'Hike Diamond Head at sunrise — the crowd arrives after 8am.' },
  { lat:-45.0312,lng:168.6626,label:'Queenstown',country:'New Zealand',continent:'Oceania',color:'#06B6D4',timezone:'Pacific/Auckland',currency:'NZD',language:'English',population:'0.04M',costLevel:3,climate:'temperate',bestMonths:['Dec','Jan','Feb','Jun'],highlights:['Bungee Jumping','Milford Sound','Ski Fields'],cuisine:['Fergburger','Central Otago Pinot Noir','Seafood Chowder'],tip:'Book Milford Sound cruises far in advance in peak summer.' },
  { lat:-27.4698,lng:153.0251,label:'Brisbane',country:'Australia',continent:'Oceania',color:'#EF4444',timezone:'Australia/Brisbane',currency:'AUD',language:'English',population:'2.5M',costLevel:3,climate:'subtropical',bestMonths:['Apr','May','Jun','Sep'],highlights:['South Bank','Lone Pine Koala Sanctuary','Great Barrier Reef trip'],cuisine:['Moreton Bay Bugs','XXXX Gold','Lamingtons'],tip:'Day trip to the Gold Coast or Sunshine Coast for world-class beaches.' },
  { lat:-17.7134,lng:178.0650,label:'Nadi',country:'Fiji',continent:'Oceania',color:'#10B981',timezone:'Pacific/Fiji',currency:'FJD',language:'English',population:'0.05M',costLevel:3,climate:'tropical',bestMonths:['May','Jun','Jul','Aug'],highlights:['Mamanuca Islands','Yasawa Islands','Garden of the Sleeping Giant'],cuisine:['Kokoda','Lovo','Rourou'],tip:'Island-hopping by ferry is cheap and spectacular.' },
  { lat:-43.5321,lng:172.6362,label:'Christchurch',country:'New Zealand',continent:'Oceania',color:'#8B5CF6',timezone:'Pacific/Auckland',currency:'NZD',language:'English',population:'0.4M',costLevel:3,climate:'temperate',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Botanic Gardens','Cardboard Cathedral','Akaroa'],cuisine:['Whitebait Fritters','Canterbury Lamb','Craft Beer'],tip:'Akaroa is 90 minutes away and feels like Provence by the sea.' },

  // Middle East
  { lat:31.7683,lng:35.2137,label:'Jerusalem',country:'Israel',continent:'Middle East',color:'#F59E0B',timezone:'Asia/Jerusalem',currency:'ILS',language:'Hebrew',population:'0.9M',costLevel:3,climate:'mediterranean',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Old City','Western Wall','Church of Holy Sepulchre'],cuisine:['Falafel','Hummus','Shakshuka'],tip:'The Old City\'s four quarters can be walked in a day.' },
  { lat:25.2854,lng:51.5310,label:'Doha',country:'Qatar',continent:'Middle East',color:'#3B82F6',timezone:'Asia/Qatar',currency:'QAR',language:'Arabic',population:'0.6M',costLevel:4,climate:'arid',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Museum of Islamic Art','Souq Waqif','The Pearl'],cuisine:['Machboos','Harees','Luqaimat'],tip:'Alcohol is only served in licensed hotel bars.' },
  { lat:24.4539,lng:54.3773,label:'Abu Dhabi',country:'UAE',continent:'Middle East',color:'#06B6D4',timezone:'Asia/Dubai',currency:'AED',language:'Arabic',population:'1.5M',costLevel:4,climate:'arid',bestMonths:['Nov','Dec','Jan','Feb'],highlights:['Sheikh Zayed Grand Mosque','Louvre Abu Dhabi','Yas Island'],cuisine:['Luqaimat','Harees','Shawarma'],tip:'Sheikh Zayed Mosque is free to visit outside prayer times.' },
  { lat:23.5880,lng:58.3829,label:'Muscat',country:'Oman',continent:'Middle East',color:'#10B981',timezone:'Asia/Muscat',currency:'OMR',language:'Arabic',population:'1.4M',costLevel:3,climate:'arid',bestMonths:['Oct','Nov','Feb','Mar'],highlights:['Sultan Qaboos Grand Mosque','Mutrah Souq','Wahiba Sands'],cuisine:['Shuwa','Harees','Kahwa'],tip:'Oman is the most welcoming Middle East country for travellers.' },
  { lat:33.8938,lng:35.5018,label:'Beirut',country:'Lebanon',continent:'Middle East',color:'#EF4444',timezone:'Asia/Beirut',currency:'LBP',language:'Arabic',population:'2.4M',costLevel:2,climate:'mediterranean',bestMonths:['Apr','May','Sep','Oct'],highlights:['Gemmayzeh','Pigeon Rocks','Jeita Grotto'],cuisine:['Meze','Shawarma','Knefeh'],tip:'Lebanese hospitality is extraordinary — accept every tea invitation.' },
  { lat:31.9522,lng:35.2332,label:'Amman',country:'Jordan',continent:'Middle East',color:'#8B5CF6',timezone:'Asia/Amman',currency:'JOD',language:'Arabic',population:'4.4M',costLevel:2,climate:'mediterranean',bestMonths:['Mar','Apr','Oct','Nov'],highlights:['Petra','Wadi Rum','Roman Theatre'],cuisine:['Mansaf','Knefeh','Falafel'],tip:'Petra requires at least 2 days — most only see the Treasury.' },
];

const WORLD_ARCS = [
  { from:{lat:40.7128,lng:-74.006}, to:{lat:48.8566,lng:2.3522},   color:'#3B82F6' },
  { from:{lat:48.8566,lng:2.3522},  to:{lat:35.6762,lng:139.6503}, color:'#8B5CF6' },
  { from:{lat:35.6762,lng:139.6503},to:{lat:-33.8688,lng:151.2093},color:'#06B6D4' },
  { from:{lat:51.5074,lng:-0.1278}, to:{lat:1.3521,lng:103.8198},  color:'#10B981' },
  { from:{lat:-22.9068,lng:-43.1729},to:{lat:40.7128,lng:-74.006}, color:'#EC4899' },
  { from:{lat:30.0444,lng:31.2357}, to:{lat:-33.9249,lng:18.4241}, color:'#F59E0B' },
  { from:{lat:25.2048,lng:55.2708}, to:{lat:1.3521,lng:103.8198},  color:'#06B6D4' },
];

const CONTINENTS = ['All','Asia','Europe','Americas','Africa','Oceania','Middle East'];
const MODES = [
  { id:'discover', icon:'🌍', label:'Discover' },
  { id:'budget',   icon:'💰', label:'Budget'   },
  { id:'climate',  icon:'🌤️', label:'Climate'  },
  { id:'routes',   icon:'✈️', label:'Routes'   },
];
const MODE_LEGENDS = {
  budget:  [{color:'#10B981',label:'Budget-friendly'},{color:'#F59E0B',label:'Mid-range'},{color:'#EF4444',label:'Expensive'}],
  climate: [{color:'#f97316',label:'Tropical'},{color:'#3B82F6',label:'Temperate'},{color:'#eab308',label:'Arid'},{color:'#8B5CF6',label:'Continental'},{color:'#10B981',label:'Highland'},{color:'#e2e8f0',label:'Polar'}],
};
const SEASON_MAP = {1:'Winter',2:'Winter',3:'Spring',4:'Spring',5:'Spring',6:'Summer',7:'Summer',8:'Summer',9:'Autumn',10:'Autumn',11:'Autumn',12:'Winter'};

function getLocalTime(tz) {
  try { return new Date().toLocaleTimeString('en-US',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); } catch { return '--:--:--'; }
}
function getLocalSeason(tz) {
  try { const m=new Date().toLocaleDateString('en-US',{timeZone:tz,month:'numeric'}); return SEASON_MAP[parseInt(m)]??''; } catch { return ''; }
}
function CostDots({level}) {
  return <span>{Array.from({length:5},(_,i)=><span key={i} className={`inline-block w-2 h-2 rounded-full mx-0.5 ${i<level?'bg-atlas-blue':'bg-white/20'}`}/>)}</span>;
}
function PlaceCard({place,onAdd}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl glass hover:bg-white/[0.06] transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-base">📍</div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{place.name}</p>
        {place.address && <p className="text-atlas-text-muted text-[11px] truncate mt-0.5">{place.address}</p>}
        {place.rating!=null && <p className="text-atlas-cyan text-[11px] mt-0.5">⭐ {Number(place.rating).toFixed(1)}</p>}
      </div>
      <button onClick={()=>onAdd?.(place)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-[10px] text-atlas-blue border border-atlas-blue/30 rounded-lg px-2 py-1 hover:bg-atlas-blue/10">+ Trip</button>
    </div>
  );
}
function SkeletonCard() {
  return <div className="flex items-start gap-3 p-3 rounded-xl glass animate-pulse"><div className="w-9 h-9 rounded-lg bg-white/10 flex-shrink-0"/><div className="flex-1 space-y-2"><div className="h-3 bg-white/10 rounded w-3/4"/><div className="h-2 bg-white/[0.06] rounded w-1/2"/></div></div>;
}

/* ══════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════ */
export default function WorldPage() {
  const [mounted,         setMounted]         = useState(false);
  const [selectedCity,    setSelectedCity]    = useState(null);
  const [selectedIdx,     setSelectedIdx]     = useState(-1);
  const [activeContinent, setActiveContinent] = useState('All');
  const [mode,            setMode]            = useState('discover');
  const [search,          setSearch]          = useState('');
  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const [detailTab,       setDetailTab]       = useState('highlights');
  const [places,          setPlaces]          = useState({highlights:[],food:[],stay:[]});
  const [loadingPlaces,   setLoadingPlaces]   = useState(false);
  const [addLocation,     setAddLocation]     = useState(null);
  const [deepExploreCity, setDeepExploreCity] = useState(null);
  const [localTime,       setLocalTime]       = useState('');
  const globeApiRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  /* Live clock */
  useEffect(() => {
    if (!selectedCity) return;
    const tick = () => setLocalTime(getLocalTime(selectedCity.timezone));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [selectedCity]);

  /* Fetch Geoapify places when city changes */
  useEffect(() => {
    if (!selectedCity) return;
    setDetailTab('highlights');
    setPlaces({highlights:[],food:[],stay:[]});
    setLoadingPlaces(true);
    const {lat,lng} = selectedCity;
    const get = (cats,lim) => fetch(`/api/geoapify/places?categories=${encodeURIComponent(cats)}&lat=${lat}&lng=${lng}&radius=10000&limit=${lim}`).then(r=>r.json()).then(d=>d.results??[]).catch(()=>[]);
    Promise.all([
      get('tourism.sights,entertainment.museum,entertainment.attraction',6),
      get('catering.restaurant,catering.cafe,catering.bar',6),
      get('accommodation.hotel,accommodation.hostel',4),
    ]).then(([highlights,food,stay]) => { setPlaces({highlights,food,stay}); setLoadingPlaces(false); });
  }, [selectedCity]);

  const handleMarkerClick = useCallback((marker,idx) => { setSelectedCity(marker); setSelectedIdx(idx); }, []);
  const handleGlobeInit   = useCallback(({flyTo}) => { globeApiRef.current = {flyTo}; }, []);

  const flyTo = useCallback((city,idx) => {
    globeApiRef.current?.flyTo(city.lat, city.lng);
    setSelectedCity(city);
    setSelectedIdx(idx);
  }, []);

  const handleSurprise = useCallback(() => {
    const pool = activeContinent==='All' ? CITIES : CITIES.filter(c=>c.continent===activeContinent);
    const pick = pool[Math.floor(Math.random()*pool.length)];
    flyTo(pick, CITIES.indexOf(pick));
  }, [activeContinent, flyTo]);

  const filteredCities = search.trim()
    ? CITIES.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || c.country.toLowerCase().includes(search.toLowerCase()))
    : activeContinent==='All' ? CITIES : CITIES.filter(c=>c.continent===activeContinent);

  /* Auto-fly on search */
  useEffect(() => {
    if (search.trim() && filteredCities.length>0) {
      const city = filteredCities[0];
      globeApiRef.current?.flyTo(city.lat, city.lng);
      setSelectedCity(city);
      setSelectedIdx(CITIES.indexOf(city));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const tabPlaces = detailTab==='highlights' ? places.highlights : detailTab==='food' ? places.food : places.stay;

  return (
    <>
      <Head><title>World Explorer — Atlasync</title></Head>

      <div className="fixed inset-0 top-16 flex overflow-hidden bg-atlas-bg">

        {/* ── Sidebar ── */}
        <div className={`flex-shrink-0 transition-all duration-300 flex flex-col overflow-hidden ${sidebarOpen?'w-72':'w-0'}`}
          style={{background:'rgba(5,8,16,0.85)',backdropFilter:'blur(20px)',borderRight:'1px solid rgba(255,255,255,0.07)'}}>
          <div className="flex flex-col h-full overflow-hidden p-4 gap-3">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-atlas-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
              <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cities…"
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-atlas-text-muted text-sm focus:outline-none focus:border-atlas-blue/50 transition-all"/>
              {search && <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-atlas-text-muted hover:text-white text-sm">✕</button>}
            </div>

            {/* Continent pills */}
            <div className="flex flex-wrap gap-1.5">
              {CONTINENTS.map(c=>(
                <button key={c} onClick={()=>{setActiveContinent(c);setSearch('');}}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${activeContinent===c?'bg-atlas-blue text-white':'bg-white/[0.05] text-atlas-text-secondary hover:bg-white/10 hover:text-white'}`}>
                  {c}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="glass rounded-xl p-3 text-center flex-shrink-0">
              <span className="text-2xl font-black text-gradient-blue">{filteredCities.length}</span>
              <span className="text-atlas-text-muted text-xs ml-1">of {CITIES.length} cities</span>
            </div>

            {/* Surprise */}
            <button onClick={handleSurprise} className="btn-glow py-2.5 text-sm w-full flex-shrink-0"><span>✨ Surprise Me</span></button>

            {/* Mode legend */}
            {MODE_LEGENDS[mode] && (
              <div className="glass rounded-xl p-3 flex-shrink-0">
                <p className="text-[10px] font-bold text-atlas-text-muted uppercase tracking-wider mb-2">{mode} legend</p>
                {MODE_LEGENDS[mode].map(l=>(
                  <div key={l.label} className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{background:l.color}}/>
                    <span className="text-[11px] text-atlas-text-secondary">{l.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* City list */}
            <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
              {filteredCities.slice(0,80).map(city=>{
                const idx  = CITIES.indexOf(city);
                const isSel = idx===selectedIdx;
                return (
                  <button key={`${city.label}-${city.country}`} onClick={()=>flyTo(city,idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-all text-sm flex items-center gap-2 ${isSel?'bg-atlas-blue/20 border border-atlas-blue/30 text-white':'hover:bg-white/[0.04] text-atlas-text-secondary hover:text-white'}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:city.color}}/>
                    <span className="flex-1 font-medium truncate">{city.label}</span>
                    <span className="text-[10px] text-atlas-text-muted flex-shrink-0 truncate max-w-[60px]">{city.country}</span>
                  </button>
                );
              })}
              {filteredCities.length>80 && <p className="text-center text-[11px] text-atlas-text-muted py-2">+{filteredCities.length-80} more — refine search</p>}
            </div>
          </div>
        </div>

        {/* ── Globe ── */}
        <div className="relative flex-1 overflow-hidden">
          {/* Sidebar toggle */}
          <button onClick={()=>setSidebarOpen(v=>!v)}
            className="absolute top-4 left-4 z-30 w-8 h-8 glass rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
            <svg className={`w-4 h-4 text-white transition-transform duration-300 ${sidebarOpen?'':'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>

          {/* Hint */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass px-3 py-1.5 rounded-full text-xs text-atlas-text-secondary border border-white/[0.07] pointer-events-none">
            <span className="text-atlas-cyan font-bold">{CITIES.length}</span> cities · hover to pause · click to explore
          </div>

          {mounted && (
            <div className="absolute inset-0" style={{zIndex:10}}>
              <GlobeErrorBoundary>
                <WorldGlobe
                  markers={CITIES}
                  arcs={mode==='routes' ? WORLD_ARCS : []}
                  autoSpin={!selectedCity}
                  selectedIdx={selectedIdx}
                  activeContinent={activeContinent}
                  mode={mode}
                  onMarkerClick={handleMarkerClick}
                  onGlobeInit={handleGlobeInit}
                  className="w-full h-full"
                />
              </GlobeErrorBoundary>
            </div>
          )}

          {/* Mode switcher */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 glass p-1 rounded-2xl">
            {MODES.map(m=>(
              <button key={m.id} onClick={()=>setMode(m.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${mode===m.id?'bg-atlas-blue text-white':'text-atlas-text-secondary hover:text-white hover:bg-white/[0.06]'}`}>
                <span>{m.icon}</span><span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── City Detail Panel ── */}
        {selectedCity && (
          <div className="flex-shrink-0 w-80 flex flex-col overflow-hidden"
            style={{background:'rgba(5,8,16,0.9)',backdropFilter:'blur(24px)',borderLeft:'1px solid rgba(255,255,255,0.07)',animation:'slide-in-right 0.3s cubic-bezier(0.25,0.46,0.45,0.94) both'}}>

            {/* Header */}
            <div className="relative p-5 flex-shrink-0" style={{background:`linear-gradient(135deg, ${selectedCity.color}22, transparent 60%)`}}>
              <button onClick={()=>{setSelectedCity(null);setSelectedIdx(-1);}}
                className="absolute top-4 right-4 w-7 h-7 rounded-lg glass flex items-center justify-center text-atlas-text-muted hover:text-white hover:bg-white/10 transition-colors text-sm">✕</button>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xl"
                  style={{background:`${selectedCity.color}30`,border:`1px solid ${selectedCity.color}40`}}>🌐</div>
                <div>
                  <h2 className="text-xl font-black text-white leading-tight">{selectedCity.label}</h2>
                  <p className="text-sm text-atlas-text-secondary">{selectedCity.country}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="glass px-3 py-1.5 rounded-xl">
                  <p className="text-[10px] text-atlas-text-muted">Local Time</p>
                  <p className="text-atlas-cyan font-mono font-bold text-sm">{localTime}</p>
                </div>
                <div className="glass px-3 py-1.5 rounded-xl">
                  <p className="text-[10px] text-atlas-text-muted">Season</p>
                  <p className="text-white font-medium text-sm">{getLocalSeason(selectedCity.timezone)}</p>
                </div>
              </div>
            </div>

            {/* Quick facts */}
            <div className="px-4 py-3 flex-shrink-0 border-b border-white/[0.06]">
              <div className="grid grid-cols-2 gap-2">
                {[{icon:'💬',label:'Language',value:selectedCity.language},{icon:'💰',label:'Currency',value:selectedCity.currency},{icon:'👥',label:'Population',value:selectedCity.population},{icon:'🌡️',label:'Climate',value:selectedCity.climate}].map(f=>(
                  <div key={f.label} className="glass rounded-xl p-2.5">
                    <p className="text-[10px] text-atlas-text-muted">{f.icon} {f.label}</p>
                    <p className="text-xs text-white font-medium mt-0.5 capitalize">{f.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-4">
                <div><p className="text-[10px] text-atlas-text-muted mb-1">Cost Level</p><CostDots level={selectedCity.costLevel}/></div>
                <div className="flex-1"><p className="text-[10px] text-atlas-text-muted mb-1">Best Months</p><p className="text-[11px] text-atlas-cyan">{selectedCity.bestMonths.join(' · ')}</p></div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 py-2 flex-shrink-0 border-b border-white/[0.06]">
              <div className="flex gap-1">
                {[{id:'highlights',label:'⭐ Sights'},{id:'food',label:'🍜 Food'},{id:'stay',label:'🏨 Stay'}].map(t=>(
                  <button key={t.id} onClick={()=>setDetailTab(t.id)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${detailTab===t.id?'bg-atlas-blue/20 text-atlas-cyan border border-atlas-blue/30':'text-atlas-text-muted hover:text-white'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Places */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
              {loadingPlaces
                ? Array.from({length:4}).map((_,i)=><SkeletonCard key={i}/>)
                : tabPlaces.length>0
                  ? tabPlaces.map((p,i)=><PlaceCard key={`${p.name}-${i}`} place={p} onAdd={loc=>setAddLocation({name:loc.name,lat:loc.lat,lng:loc.lng,address:loc.address})}/>)
                  : <div className="text-center py-8"><div className="text-3xl mb-2">🔍</div><p className="text-atlas-text-muted text-sm">No places found</p><p className="text-atlas-text-muted text-xs mt-1">Add GEOAPIFY_API_KEY to .env.local</p></div>
              }
            </div>

            {/* Tip */}
            {selectedCity.tip && (
              <div className="px-4 py-3 flex-shrink-0 border-t border-white/[0.06]">
                <div className="glass-blue glass rounded-xl p-3">
                  <p className="text-[10px] font-bold text-atlas-blue uppercase tracking-wider mb-1">💡 Insider Tip</p>
                  <p className="text-xs text-atlas-text-secondary leading-relaxed">{selectedCity.tip}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-4 flex-shrink-0 border-t border-white/[0.06] flex gap-2">
              <Link href="/dashboard" className="flex-1 btn-glow py-2.5 text-sm text-center"><span>Plan a Trip</span></Link>
              <button
                onClick={()=>setDeepExploreCity({name:selectedCity.label,country:selectedCity.country,lat:selectedCity.lat,lng:selectedCity.lng})}
                className="btn-ghost py-2.5 px-3 text-sm">Deep →</button>
            </div>
          </div>
        )}
      </div>

      {deepExploreCity && <CityPanel city={deepExploreCity} onClose={()=>setDeepExploreCity(null)} onAddToTrip={loc=>setAddLocation(loc)}/>}
      {addLocation && <AddToTripModal location={addLocation} onClose={()=>setAddLocation(null)} onAdded={()=>setAddLocation(null)}/>}
    </>
  );
}
