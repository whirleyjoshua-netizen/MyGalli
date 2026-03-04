/**
 * Seed 3 fully-loaded demo Athlete Kit profiles:
 *   1. Marcus "Flash" Johnson — Football QB
 *   2. Sofia Reyes — Soccer Midfielder
 *   3. Ava Thompson — Girls Volleyball Outside Hitter
 *
 * Run: npx tsx prisma/seed-demos.ts
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const db = new PrismaClient()

let counter = 0
function uid(prefix: string) {
  counter++
  return `${prefix}-seed-${counter}-${Math.random().toString(36).substr(2, 8)}`
}

function makeSection(elements: any[], layout = 'full-width') {
  const colCount = layout === 'full-width' ? 1 : layout === 'two-column' ? 2 : 3
  const columns = []
  for (let i = 0; i < colCount; i++) {
    columns.push({ id: uid('col'), elements: i === 0 ? elements : [] })
  }
  return { id: uid('section'), layout, columns }
}

function el(type: string, overrides: Record<string, any> = {}) {
  return { id: uid('el'), type, ...overrides }
}

// ─── FOOTBALL: Marcus "Flash" Johnson ──────────────────────────────────
function buildFootballProfile() {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

  const profileEl = el('kit-profile', {
    kitProfileKitId: 'athlete',
    kitProfileLayout: 'card',
    kitProfileData: {
      sport: 'Football',
      position: 'Quarterback',
      classYear: '2026',
      school: 'Westfield High School',
      height: '6\'2"',
      weight: '205',
      gpa: '3.7',
      coachName: 'Coach Mike Davis',
      coachEmail: 'mdavis@westfield.edu',
      coachPhone: '(555) 234-5678',
      recruitingStatus: 'Uncommitted',
      desiredSchools: 'Ohio State, Michigan, Penn State, Alabama, Clemson',
      hudlUrl: 'https://hudl.com/profile/marcusjohnson',
      maxprepsUrl: 'https://maxpreps.com/marcusjohnson',
      youtubeUrl: 'https://youtube.com/@flashjohnson',
      socialHandles: '@flash_johnson12',
    },
  })

  // Game schedule
  const scheduleEl = el('game-schedule', {
    gameScheduleTitle: '2025 Season Schedule',
    gameScheduleShowPastGames: true,
    gameScheduleGames: [
      { date: '2025-08-29', opponent: 'Lincoln High', location: 'Westfield Stadium', homeAway: 'Home', time: '7:00 PM', result: 'W 35-14' },
      { date: '2025-09-05', opponent: 'Central Catholic', location: 'Central Field', homeAway: 'Away', time: '7:30 PM', result: 'W 28-21' },
      { date: '2025-09-12', opponent: 'Jefferson Prep', location: 'Westfield Stadium', homeAway: 'Home', time: '7:00 PM', result: 'W 42-7' },
      { date: '2025-09-19', opponent: 'St. Xavier', location: 'Crusader Field', homeAway: 'Away', time: '7:30 PM', result: 'L 21-24' },
      { date: '2025-09-26', opponent: 'Riverside Academy', location: 'Westfield Stadium', homeAway: 'Home', time: '7:00 PM', result: 'W 31-17' },
      { date: '2025-10-03', opponent: 'North Valley', location: 'Valley Stadium', homeAway: 'Away', time: '7:00 PM', result: 'W 38-10' },
      { date: '2025-10-10', opponent: 'Eastside Prep', location: 'Westfield Stadium', homeAway: 'Home', time: '7:00 PM', result: 'W 45-21' },
      { date: '2025-10-17', opponent: 'Bishop Moore', location: 'Moore Field', homeAway: 'Away', time: '7:30 PM', result: 'W 27-20' },
      { date: '2025-10-24', opponent: 'Heritage Christian', location: 'Westfield Stadium', homeAway: 'Home', time: '7:00 PM', result: '' },
      { date: '2025-10-31', opponent: 'Summit High', location: 'Summit Stadium', homeAway: 'Away', time: '7:00 PM', result: '' },
    ],
  })

  // Workout schedule
  const workoutEl = el('workout-schedule', {
    workoutScheduleTitle: 'In-Season Training',
    workoutScheduleDays: [
      { day: 'Mon', workouts: [
        { name: 'Power Clean', setsReps: '4x3 @ 225', notes: 'Explosive' },
        { name: 'Back Squat', setsReps: '4x5 @ 315', notes: '' },
        { name: 'DB Bench', setsReps: '3x8 @ 85', notes: '' },
        { name: 'Band Pull-Aparts', setsReps: '3x15', notes: 'Shoulder health' },
      ]},
      { day: 'Tue', workouts: [
        { name: 'Film Study', setsReps: '45 min', notes: 'Opponent review' },
        { name: 'Route Trees', setsReps: '30 min', notes: 'WR timing' },
        { name: 'Footwork Drills', setsReps: '20 min', notes: 'Drop back' },
      ]},
      { day: 'Wed', workouts: [
        { name: 'Hang Clean', setsReps: '3x3 @ 205', notes: '' },
        { name: 'Front Squat', setsReps: '3x5 @ 265', notes: '' },
        { name: 'Incline Bench', setsReps: '3x6 @ 185', notes: '' },
        { name: 'Core Circuit', setsReps: '3 rounds', notes: 'Planks, Pallof, Rollouts' },
      ]},
      { day: 'Thu', workouts: [
        { name: 'Walk-Through', setsReps: '30 min', notes: 'Game plan install' },
        { name: 'Mobility Work', setsReps: '20 min', notes: 'Hips & shoulders' },
        { name: 'Light Throws', setsReps: '15 min', notes: 'Touch & accuracy' },
      ]},
      { day: 'Fri', workouts: [
        { name: 'GAME DAY', setsReps: '', notes: 'Pre-game routine only' },
      ]},
      { day: 'Sat', workouts: [
        { name: 'Active Recovery', setsReps: '30 min', notes: 'Light jog, stretching' },
        { name: 'Ice Bath', setsReps: '10 min', notes: '' },
      ]},
      { day: 'Sun', workouts: [] },
    ],
  })

  // Meal prep
  const mealEl = el('meal-prep', {
    mealPrepTitle: 'Game Week Nutrition',
    mealPrepShowMacros: true,
    mealPrepMeals: MEALS.map(mealType => ({
      mealType,
      days: DAYS.map(day => {
        const meals: Record<string, Record<string, { name: string; macros: string }>> = {
          Breakfast: {
            Mon: { name: '6 Egg Whites + Oats', macros: '45P / 55C / 8F' },
            Tue: { name: 'Protein Pancakes', macros: '40P / 60C / 12F' },
            Wed: { name: 'Greek Yogurt Bowl', macros: '35P / 45C / 10F' },
            Thu: { name: 'Breakfast Burrito', macros: '40P / 50C / 15F' },
            Fri: { name: 'Pre-Game: Oatmeal + Banana', macros: '20P / 70C / 5F' },
            Sat: { name: 'Recovery Smoothie', macros: '50P / 40C / 10F' },
            Sun: { name: 'Brunch: Eggs & Toast', macros: '35P / 45C / 12F' },
          },
          Lunch: {
            Mon: { name: 'Grilled Chicken + Rice', macros: '50P / 65C / 12F' },
            Tue: { name: 'Turkey Wrap + Sweet Potato', macros: '45P / 55C / 10F' },
            Wed: { name: 'Salmon + Quinoa Bowl', macros: '45P / 50C / 18F' },
            Thu: { name: 'Chicken Pasta', macros: '50P / 70C / 15F' },
            Fri: { name: 'Pre-Game: Chicken + Pasta', macros: '45P / 80C / 10F' },
            Sat: { name: 'Steak + Potatoes', macros: '55P / 50C / 20F' },
            Sun: { name: 'Meal Prep Day', macros: '' },
          },
          Dinner: {
            Mon: { name: 'Lean Beef Stir Fry', macros: '50P / 45C / 15F' },
            Tue: { name: 'Baked Chicken Thighs', macros: '48P / 35C / 18F' },
            Wed: { name: 'Fish Tacos + Beans', macros: '40P / 50C / 14F' },
            Thu: { name: 'Light: Soup + Sandwich', macros: '30P / 40C / 10F' },
            Fri: { name: 'Post-Game: Pizza (earned)', macros: '30P / 60C / 25F' },
            Sat: { name: 'Grilled Chicken Salad', macros: '45P / 25C / 12F' },
            Sun: { name: 'Family Dinner', macros: '' },
          },
          Snacks: {
            Mon: { name: 'Protein Shake + Almonds', macros: '30P / 10C / 15F' },
            Tue: { name: 'PB&J + Banana', macros: '15P / 45C / 12F' },
            Wed: { name: 'Beef Jerky + Trail Mix', macros: '25P / 20C / 10F' },
            Thu: { name: 'Protein Bar', macros: '20P / 25C / 8F' },
            Fri: { name: 'Banana + Honey', macros: '2P / 35C / 0F' },
            Sat: { name: 'Chocolate Milk', macros: '16P / 26C / 8F' },
            Sun: { name: 'Rest Day Snack', macros: '' },
          },
        }
        const data = meals[mealType]?.[day] || { name: '', macros: '' }
        return { day, name: data.name, notes: '', macros: data.macros }
      }),
    })),
  })

  // Camp/combine tracker element
  const campTrackerEl = el('tracker', {
    trackerKitId: 'athlete',
    trackerConfigId: 'camp-combine',
    trackerTitle: 'Camp & Combine',
    trackerColor: '#E74C3C',
    trackerChartType: 'bar',
    trackerShowSummary: true,
    trackerTimeRange: 'all',
  })

  // Jersey
  const jerseyEl = el('jersey', {
    jerseyNumber: '12',
    jerseyName: 'JOHNSON',
    jerseyPrimaryColor: '#1a3a5c',
    jerseySecondaryColor: '#c4a43e',
    jerseyStyle: 'classic',
    jerseySignaturesEnabled: true,
  })

  // Tracker elements for performance tab
  const fortyTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'forty-yard', trackerTitle: '40-Yard Dash', trackerColor: '#39D98A', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const liftTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'lift', trackerTitle: 'Lift Tracker', trackerColor: '#6C63FF', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const bodyTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'body-metrics', trackerTitle: 'Body Metrics', trackerColor: '#1FB6FF', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const gameStatTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'game-stats', trackerTitle: 'Game Stats', trackerColor: '#F59E0B', trackerChartType: 'bar', trackerShowSummary: true, trackerTimeRange: 'all' })

  // Build tabs — 5 tabs with elements distributed as cards
  const tabs = [
    { id: uid('tab'), label: 'Profile', slug: 'profile', sections: [
      makeSection([profileEl]),
      makeSection([jerseyEl]),
    ]},
    { id: uid('tab'), label: 'Performance', slug: 'performance', sections: [
      makeSection([fortyTracker]),
      makeSection([liftTracker]),
      makeSection([bodyTracker]),
      makeSection([workoutEl]),
      makeSection([mealEl]),
    ]},
    { id: uid('tab'), label: 'Stats', slug: 'stats', sections: [
      makeSection([scheduleEl]),
      makeSection([gameStatTracker]),
      makeSection([campTrackerEl]),
    ]},
    { id: uid('tab'), label: 'Highlights', slug: 'highlights', sections: [
      makeSection([
        el('heading', { content: 'Season Highlights', level: 2, fontFamily: 'Oswald', fontWeight: 700 }),
        el('embed', { embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embedType: 'youtube' }),
        el('text', { content: '<p>Junior year highlight reel — 3,200 passing yards, 32 TDs, 4 INTs. Led Westfield to regional semifinals.</p>' }),
        el('kpi', { kpiLabel: 'Passing Yards', kpiValue: '3,200', kpiSuffix: 'yds', kpiTrend: 'up', kpiTrendValue: '+800 from soph yr', kpiColor: 'blue' }),
        el('kpi', { kpiLabel: 'Touchdowns', kpiValue: '32', kpiSuffix: 'TDs', kpiTrend: 'up', kpiTrendValue: '+12', kpiColor: 'green' }),
        el('kpi', { kpiLabel: 'QBR', kpiValue: '94.2', kpiTrend: 'up', kpiTrendValue: '+8.5', kpiColor: 'purple' }),
      ]),
    ]},
    { id: uid('tab'), label: 'About Me', slug: 'about-me', sections: [
      makeSection([
        el('heading', { content: 'About Marcus', level: 2 }),
        el('text', { content: '<p>I\'m a dual-threat quarterback from Westfield, Ohio with a passion for the game that started in my backyard at age 5. My dad played D2 football at Ashland University, and watching him taught me that greatness comes from relentless preparation.</p><p>Off the field, I\'m a 3.7 GPA student who loves chess club and volunteers at the local Boys & Girls Club coaching flag football for 3rd graders. I believe in giving back to the community that raised me.</p>' }),
        el('heading', { content: 'Why I Play', level: 3 }),
        el('text', { content: '<p>Football is more than a sport to me — it\'s where I learned leadership, resilience, and the power of trusting your team. There\'s nothing like the feeling of leading a 4th quarter comeback drive with 80,000 imaginary fans in my head (for now).</p>' }),
        el('heading', { content: 'Goals', level: 3 }),
        el('list', { listType: 'bulleted', listTitle: 'Short & Long Term', items: ['Earn a D1 scholarship at a Power 5 program', 'Break school record for career passing TDs (needs 18 more)', 'Maintain 3.5+ GPA through senior year', 'Lead Westfield to state championship', 'Study Sports Management in college'] }),
      ]),
    ]},
  ]

  const headerCard = {
    enabled: true,
    template: 'profile',
    name: 'Marcus "Flash" Johnson',
    title: 'Quarterback • Class of 2026',
    subtitle: 'Westfield High School • Westfield, OH',
    photoUrl: '',
    photoPosition: 'center-overlap',
    actions: [
      { id: uid('action'), label: 'Hudl Profile', url: 'https://hudl.com', icon: 'link', variant: 'solid', color: 'blue' },
      { id: uid('action'), label: 'Email Coach', url: 'mailto:mdavis@westfield.edu', icon: 'mail', variant: 'outline', color: 'green' },
    ],
    textAlignment: 'center',
  }

  return {
    slug: 'marcus-johnson-qb',
    title: 'Marcus Johnson — Football',
    tabs: { enabled: true, tabs, style: 'pills', alignment: 'center' },
    headerCard,
    kitConfig: { kitId: 'athlete', version: 1, profile: {} },
    sections: tabs[0].sections,
    trackerEntries: {
      fortyYard: buildFortyEntries(fortyTracker.id),
      lift: buildLiftEntries(liftTracker.id),
      bodyMetrics: buildBodyEntries(bodyTracker.id),
      gameStats: buildFootballGameStats(gameStatTracker.id),
      campCombine: buildFootballCampEntries(campTrackerEl.id),
    },
  }
}

// ─── SOCCER: Sofia Reyes ──────────────────────────────────────────────
function buildSoccerProfile() {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

  const profileEl = el('kit-profile', {
    kitProfileKitId: 'athlete',
    kitProfileLayout: 'card',
    kitProfileData: {
      sport: 'Soccer',
      position: 'Central Midfielder',
      classYear: '2027',
      school: 'Cypress Bay High School',
      height: '5\'6"',
      weight: '135',
      gpa: '4.1',
      coachName: 'Coach Ana Martinez',
      coachEmail: 'amartinez@cypressbay.edu',
      coachPhone: '(555) 876-5432',
      recruitingStatus: 'Uncommitted',
      desiredSchools: 'UNC, Stanford, UCLA, Duke, Virginia',
      hudlUrl: 'https://hudl.com/profile/sofiareyes',
      youtubeUrl: 'https://youtube.com/@sofiareyes10',
      socialHandles: '@sofia.reyes10',
    },
  })

  const scheduleEl = el('game-schedule', {
    gameScheduleTitle: '2025 Spring Season',
    gameScheduleShowPastGames: true,
    gameScheduleGames: [
      { date: '2025-02-15', opponent: 'Coral Glades', location: 'Cypress Bay Field', homeAway: 'Home', time: '4:00 PM', result: 'W 3-1' },
      { date: '2025-02-20', opponent: 'Stoneman Douglas', location: 'Douglas Stadium', homeAway: 'Away', time: '6:00 PM', result: 'W 2-0' },
      { date: '2025-02-27', opponent: 'Western High', location: 'Cypress Bay Field', homeAway: 'Home', time: '4:00 PM', result: 'D 1-1' },
      { date: '2025-03-06', opponent: 'St. Thomas Aquinas', location: 'Aquinas Stadium', homeAway: 'Away', time: '5:30 PM', result: 'W 4-2' },
      { date: '2025-03-13', opponent: 'Plantation High', location: 'Cypress Bay Field', homeAway: 'Home', time: '4:00 PM', result: 'W 5-0' },
      { date: '2025-03-20', opponent: 'Cooper City', location: 'Cooper City Park', homeAway: 'Away', time: '6:00 PM', result: '' },
      { date: '2025-03-27', opponent: 'Piper High', location: 'Cypress Bay Field', homeAway: 'Home', time: '4:00 PM', result: '' },
      { date: '2025-04-03', opponent: 'South Broward', location: 'SB Stadium', homeAway: 'Away', time: '5:30 PM', result: '' },
    ],
  })

  const workoutEl = el('workout-schedule', {
    workoutScheduleTitle: 'Season Training Plan',
    workoutScheduleDays: [
      { day: 'Mon', workouts: [
        { name: 'Agility Ladder', setsReps: '4 sets', notes: 'Quick feet' },
        { name: 'Bulgarian Split Squat', setsReps: '3x10 each', notes: '' },
        { name: 'Nordic Hamstring Curl', setsReps: '3x6', notes: 'Injury prevention' },
        { name: 'Core Stability', setsReps: '15 min', notes: '' },
      ]},
      { day: 'Tue', workouts: [
        { name: 'Team Practice', setsReps: '90 min', notes: 'Possession drills' },
        { name: 'Shooting Practice', setsReps: '30 min', notes: 'Both feet' },
      ]},
      { day: 'Wed', workouts: [
        { name: 'Hip Thrust', setsReps: '4x8 @ 155', notes: '' },
        { name: 'Single Leg RDL', setsReps: '3x10 each', notes: '' },
        { name: 'Plyo Box Jumps', setsReps: '4x5', notes: '' },
        { name: 'Yoga / Flexibility', setsReps: '30 min', notes: '' },
      ]},
      { day: 'Thu', workouts: [
        { name: 'Team Practice', setsReps: '90 min', notes: 'Set pieces' },
        { name: 'Extra Crossing Drills', setsReps: '20 min', notes: '' },
      ]},
      { day: 'Fri', workouts: [
        { name: 'Light Activation', setsReps: '15 min', notes: 'Pre-match' },
        { name: 'Stretching', setsReps: '15 min', notes: '' },
      ]},
      { day: 'Sat', workouts: [
        { name: 'MATCH DAY', setsReps: '', notes: '' },
      ]},
      { day: 'Sun', workouts: [
        { name: 'Recovery Swim', setsReps: '20 min', notes: '' },
        { name: 'Foam Rolling', setsReps: '15 min', notes: '' },
      ]},
    ],
  })

  const mealEl = el('meal-prep', {
    mealPrepTitle: 'Match Week Fuel',
    mealPrepShowMacros: true,
    mealPrepMeals: MEALS.map(mealType => ({
      mealType,
      days: DAYS.map(day => {
        const m: Record<string, Record<string, { name: string; macros: string }>> = {
          Breakfast: {
            Mon: { name: 'Açaí Bowl + Granola', macros: '20P / 55C / 12F' },
            Tue: { name: 'Avocado Toast + Eggs', macros: '25P / 35C / 18F' },
            Wed: { name: 'Smoothie Bowl', macros: '30P / 50C / 8F' },
            Thu: { name: 'Overnight Oats', macros: '22P / 48C / 10F' },
            Fri: { name: 'Banana Pancakes', macros: '20P / 55C / 8F' },
            Sat: { name: 'Pre-Match: Toast + Honey', macros: '10P / 60C / 4F' },
            Sun: { name: 'Veggie Omelet', macros: '28P / 15C / 14F' },
          },
          Lunch: {
            Mon: { name: 'Chicken Quinoa Bowl', macros: '40P / 50C / 12F' },
            Tue: { name: 'Turkey Club Wrap', macros: '35P / 40C / 15F' },
            Wed: { name: 'Poke Bowl', macros: '35P / 55C / 10F' },
            Thu: { name: 'Grilled Chicken Salad', macros: '38P / 20C / 14F' },
            Fri: { name: 'Pasta Primavera', macros: '25P / 65C / 10F' },
            Sat: { name: 'Pre-Match: Rice + Chicken', macros: '35P / 60C / 8F' },
            Sun: { name: 'Leftovers', macros: '' },
          },
          Dinner: {
            Mon: { name: 'Salmon + Veggies', macros: '40P / 25C / 20F' },
            Tue: { name: 'Turkey Tacos', macros: '35P / 40C / 12F' },
            Wed: { name: 'Shrimp Stir Fry', macros: '35P / 45C / 10F' },
            Thu: { name: 'Chicken Curry + Rice', macros: '38P / 55C / 14F' },
            Fri: { name: 'Light Pasta', macros: '25P / 60C / 8F' },
            Sat: { name: 'Post-Match: Whatever I Want', macros: '' },
            Sun: { name: 'Meal Prep Sunday', macros: '' },
          },
          Snacks: {
            Mon: { name: 'Greek Yogurt + Berries', macros: '18P / 20C / 5F' },
            Tue: { name: 'Apple + Almond Butter', macros: '5P / 25C / 12F' },
            Wed: { name: 'Protein Shake', macros: '25P / 5C / 2F' },
            Thu: { name: 'Rice Cakes + Honey', macros: '3P / 30C / 1F' },
            Fri: { name: 'Energy Balls', macros: '8P / 20C / 10F' },
            Sat: { name: 'Oranges + Electrolytes', macros: '2P / 25C / 0F' },
            Sun: { name: 'Smoothie', macros: '20P / 30C / 5F' },
          },
        }
        const data = m[mealType]?.[day] || { name: '', macros: '' }
        return { day, name: data.name, notes: '', macros: data.macros }
      }),
    })),
  })

  const campTrackerEl = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'camp-combine', trackerTitle: 'Camp & Combine', trackerColor: '#E74C3C', trackerChartType: 'bar', trackerShowSummary: true, trackerTimeRange: 'all' })

  const jerseyEl = el('jersey', {
    jerseyNumber: '10',
    jerseyName: 'REYES',
    jerseyPrimaryColor: '#1e3a5f',
    jerseySecondaryColor: '#ffffff',
    jerseyStyle: 'modern',
    jerseySignaturesEnabled: true,
  })

  const fortyTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'forty-yard', trackerTitle: '40-Yard Dash', trackerColor: '#39D98A', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const liftTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'lift', trackerTitle: 'Lift Tracker', trackerColor: '#6C63FF', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const bodyTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'body-metrics', trackerTitle: 'Body Metrics', trackerColor: '#1FB6FF', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const gameStatTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'game-stats', trackerTitle: 'Game Stats', trackerColor: '#F59E0B', trackerChartType: 'bar', trackerShowSummary: true, trackerTimeRange: 'all' })

  const tabs = [
    { id: uid('tab'), label: 'Profile', slug: 'profile', sections: [
      makeSection([profileEl]),
      makeSection([jerseyEl]),
    ]},
    { id: uid('tab'), label: 'Performance', slug: 'performance', sections: [
      makeSection([fortyTracker]),
      makeSection([liftTracker]),
      makeSection([bodyTracker]),
      makeSection([workoutEl]),
      makeSection([mealEl]),
    ]},
    { id: uid('tab'), label: 'Stats', slug: 'stats', sections: [
      makeSection([scheduleEl]),
      makeSection([gameStatTracker]),
      makeSection([campTrackerEl]),
    ]},
    { id: uid('tab'), label: 'Highlights', slug: 'highlights', sections: [
      makeSection([
        el('heading', { content: 'Match Highlights', level: 2 }),
        el('text', { content: '<p>Sophomore season: 14 goals, 11 assists across 22 matches. Named All-County First Team and team MVP.</p>' }),
        el('kpi', { kpiLabel: 'Goals', kpiValue: '14', kpiTrend: 'up', kpiTrendValue: '+6 from freshman yr', kpiColor: 'green' }),
        el('kpi', { kpiLabel: 'Assists', kpiValue: '11', kpiTrend: 'up', kpiTrendValue: '+4', kpiColor: 'blue' }),
        el('kpi', { kpiLabel: 'Pass Accuracy', kpiValue: '87%', kpiTrend: 'up', kpiTrendValue: '+5%', kpiColor: 'purple' }),
      ]),
    ]},
    { id: uid('tab'), label: 'About Me', slug: 'about-me', sections: [
      makeSection([
        el('heading', { content: 'About Sofia', level: 2 }),
        el('text', { content: '<p>Born in Miami to Colombian parents, I grew up watching La Liga with my abuelo and started playing club soccer at age 4. Soccer is in my blood — my mom played semi-pro in Colombia before moving to the US.</p><p>I\'m a 4.1 GPA student in the IB program, fluent in Spanish and English, and I dream of playing in the NWSL after college. When I\'m not on the pitch, I\'m tutoring underclassmen in math or working on my photography.</p>' }),
        el('heading', { content: 'My Style of Play', level: 3 }),
        el('text', { content: '<p>I\'m a creative #10 who plays between the lines. My strengths are vision, through-balls, and set piece delivery. I model my game after Aitana Bonmatí — always looking for the killer pass.</p>' }),
        el('heading', { content: 'Goals', level: 3 }),
        el('list', { listType: 'bulleted', listTitle: '', items: ['Earn a D1 scholarship to a top-10 program', 'Make the US U-17 National Team pool', 'Break school record for assists in a season (needs 4 more)', 'Maintain IB Diploma track with 4.0+ GPA', 'Play professional soccer'] }),
      ]),
    ]},
  ]

  return {
    slug: 'sofia-reyes-soccer',
    title: 'Sofia Reyes — Soccer',
    tabs: { enabled: true, tabs, style: 'pills', alignment: 'center' },
    headerCard: {
      enabled: true, template: 'profile',
      name: 'Sofia Reyes',
      title: 'Central Midfielder • Class of 2027',
      subtitle: 'Cypress Bay High School • Weston, FL',
      photoUrl: '', photoPosition: 'center-overlap',
      actions: [
        { id: uid('action'), label: 'Highlight Reel', url: 'https://youtube.com', icon: 'link', variant: 'solid', color: 'blue' },
        { id: uid('action'), label: 'Contact Coach', url: 'mailto:amartinez@cypressbay.edu', icon: 'mail', variant: 'outline', color: 'green' },
      ],
      textAlignment: 'center',
    },
    kitConfig: { kitId: 'athlete', version: 1, profile: {} },
    sections: tabs[0].sections,
    trackerEntries: {
      fortyYard: buildSoccerSprintEntries(fortyTracker.id),
      lift: buildSoccerLiftEntries(liftTracker.id),
      bodyMetrics: buildSoccerBodyEntries(bodyTracker.id),
      gameStats: buildSoccerGameStats(gameStatTracker.id),
      campCombine: buildSoccerCampEntries(campTrackerEl.id),
    },
  }
}

// ─── VOLLEYBALL: Ava Thompson ──────────────────────────────────────────
function buildVolleyballProfile() {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']

  const profileEl = el('kit-profile', {
    kitProfileKitId: 'athlete',
    kitProfileLayout: 'card',
    kitProfileData: {
      sport: 'Volleyball',
      position: 'Outside Hitter',
      classYear: '2026',
      school: 'Mater Dei High School',
      height: '5\'11"',
      weight: '160',
      gpa: '3.9',
      coachName: 'Coach Sarah Kim',
      coachEmail: 'skim@materdei.org',
      coachPhone: '(555) 345-6789',
      recruitingStatus: 'Uncommitted',
      desiredSchools: 'USC, Nebraska, Texas, Wisconsin, Penn State',
      hudlUrl: 'https://hudl.com/profile/avathompson',
      youtubeUrl: 'https://youtube.com/@avat_volleyball',
      socialHandles: '@ava.t.volleyball',
    },
  })

  const scheduleEl = el('game-schedule', {
    gameScheduleTitle: '2025 Fall Season',
    gameScheduleShowPastGames: true,
    gameScheduleGames: [
      { date: '2025-08-26', opponent: 'JSerra Catholic', location: 'Mater Dei Gym', homeAway: 'Home', time: '5:30 PM', result: 'W 3-1' },
      { date: '2025-09-02', opponent: 'Orange Lutheran', location: 'OLu Arena', homeAway: 'Away', time: '6:00 PM', result: 'W 3-0' },
      { date: '2025-09-09', opponent: 'St. Margaret\'s', location: 'Mater Dei Gym', homeAway: 'Home', time: '5:30 PM', result: 'W 3-2' },
      { date: '2025-09-16', opponent: 'Marymount', location: 'Marymount Gym', homeAway: 'Away', time: '6:00 PM', result: 'W 3-0' },
      { date: '2025-09-23', opponent: 'Rosary Academy', location: 'Mater Dei Gym', homeAway: 'Home', time: '5:30 PM', result: 'W 3-1' },
      { date: '2025-09-30', opponent: 'Santa Margarita', location: 'SM Arena', homeAway: 'Away', time: '6:00 PM', result: 'L 2-3' },
      { date: '2025-10-07', opponent: 'Servite', location: 'Mater Dei Gym', homeAway: 'Home', time: '5:30 PM', result: '' },
      { date: '2025-10-14', opponent: 'Tesoro', location: 'Tesoro Gym', homeAway: 'Away', time: '6:00 PM', result: '' },
      { date: '2025-10-21', opponent: 'San Clemente', location: 'Mater Dei Gym', homeAway: 'Home', time: '5:30 PM', result: '' },
    ],
  })

  const workoutEl = el('workout-schedule', {
    workoutScheduleTitle: 'Season Training',
    workoutScheduleDays: [
      { day: 'Mon', workouts: [
        { name: 'Box Jumps', setsReps: '4x6 @ 24"', notes: 'Explosive' },
        { name: 'Trap Bar Deadlift', setsReps: '4x5 @ 185', notes: '' },
        { name: 'DB Shoulder Press', setsReps: '3x10 @ 30', notes: '' },
        { name: 'Rotator Cuff Work', setsReps: '3x12', notes: 'Injury prevention' },
      ]},
      { day: 'Tue', workouts: [
        { name: 'Team Practice', setsReps: '2 hrs', notes: 'Hitting lines' },
        { name: 'Serving Practice', setsReps: '30 min', notes: 'Jump serve focus' },
      ]},
      { day: 'Wed', workouts: [
        { name: 'Depth Jumps', setsReps: '4x5', notes: '' },
        { name: 'Split Squat', setsReps: '3x8 each @ 95', notes: '' },
        { name: 'Pull-Ups', setsReps: '4x8', notes: '' },
        { name: 'Med Ball Throws', setsReps: '3x10', notes: 'Core power' },
      ]},
      { day: 'Thu', workouts: [
        { name: 'Team Practice', setsReps: '2 hrs', notes: 'Blocking & defense' },
        { name: 'Video Review', setsReps: '30 min', notes: '' },
      ]},
      { day: 'Fri', workouts: [
        { name: 'Pre-Match Activation', setsReps: '20 min', notes: 'Bands + dynamic warm-up' },
      ]},
      { day: 'Sat', workouts: [
        { name: 'MATCH DAY', setsReps: '', notes: '' },
      ]},
      { day: 'Sun', workouts: [
        { name: 'Yoga', setsReps: '45 min', notes: 'Recovery & flexibility' },
        { name: 'Light Cardio', setsReps: '20 min', notes: 'Bike or swim' },
      ]},
    ],
  })

  const mealEl = el('meal-prep', {
    mealPrepTitle: 'Match Week Meals',
    mealPrepShowMacros: true,
    mealPrepMeals: MEALS.map(mealType => ({
      mealType,
      days: DAYS.map(day => {
        const m: Record<string, Record<string, { name: string; macros: string }>> = {
          Breakfast: {
            Mon: { name: 'Egg White Frittata', macros: '30P / 15C / 6F' },
            Tue: { name: 'Protein Waffles', macros: '28P / 45C / 8F' },
            Wed: { name: 'Overnight Oats + Protein', macros: '30P / 50C / 10F' },
            Thu: { name: 'Breakfast Sandwich', macros: '25P / 35C / 12F' },
            Fri: { name: 'Smoothie + Toast', macros: '22P / 50C / 8F' },
            Sat: { name: 'Pre-Match: Bagel + PB', macros: '15P / 55C / 10F' },
            Sun: { name: 'Veggie Scramble', macros: '28P / 20C / 10F' },
          },
          Lunch: {
            Mon: { name: 'Chicken Caesar Wrap', macros: '40P / 35C / 12F' },
            Tue: { name: 'Power Bowl', macros: '38P / 50C / 14F' },
            Wed: { name: 'Tuna Salad Sandwich', macros: '35P / 40C / 10F' },
            Thu: { name: 'Chicken Teriyaki Bowl', macros: '40P / 55C / 10F' },
            Fri: { name: 'Pasta + Grilled Chicken', macros: '38P / 60C / 12F' },
            Sat: { name: 'Pre-Match: Rice + Salmon', macros: '35P / 55C / 15F' },
            Sun: { name: 'Meal Prep Day', macros: '' },
          },
          Dinner: {
            Mon: { name: 'Grilled Tilapia + Rice', macros: '38P / 45C / 8F' },
            Tue: { name: 'Turkey Meatballs + Pasta', macros: '35P / 55C / 12F' },
            Wed: { name: 'Chicken Fajitas', macros: '38P / 35C / 14F' },
            Thu: { name: 'Lean Beef + Sweet Potato', macros: '42P / 45C / 15F' },
            Fri: { name: 'Light: Soup + Bread', macros: '20P / 40C / 8F' },
            Sat: { name: 'Post-Match: Team Dinner', macros: '' },
            Sun: { name: 'Meal Prep Cooking', macros: '' },
          },
          Snacks: {
            Mon: { name: 'Cottage Cheese + Fruit', macros: '20P / 18C / 3F' },
            Tue: { name: 'Protein Bar', macros: '20P / 22C / 8F' },
            Wed: { name: 'Banana + Peanut Butter', macros: '6P / 30C / 10F' },
            Thu: { name: 'Trail Mix', macros: '8P / 20C / 14F' },
            Fri: { name: 'Chocolate Milk', macros: '16P / 26C / 8F' },
            Sat: { name: 'Orange Slices + Gummies', macros: '1P / 30C / 0F' },
            Sun: { name: 'Yogurt Parfait', macros: '18P / 25C / 5F' },
          },
        }
        const data = m[mealType]?.[day] || { name: '', macros: '' }
        return { day, name: data.name, notes: '', macros: data.macros }
      }),
    })),
  })

  const campTrackerEl = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'camp-combine', trackerTitle: 'Camp & Combine', trackerColor: '#E74C3C', trackerChartType: 'bar', trackerShowSummary: true, trackerTimeRange: 'all' })

  const jerseyEl = el('jersey', {
    jerseyNumber: '7',
    jerseyName: 'THOMPSON',
    jerseyPrimaryColor: '#8B0000',
    jerseySecondaryColor: '#FFD700',
    jerseyStyle: 'retro',
    jerseySignaturesEnabled: true,
  })

  const fortyTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'forty-yard', trackerTitle: '40-Yard Dash', trackerColor: '#39D98A', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const liftTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'lift', trackerTitle: 'Lift Tracker', trackerColor: '#6C63FF', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const bodyTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'body-metrics', trackerTitle: 'Body Metrics', trackerColor: '#1FB6FF', trackerChartType: 'line', trackerShowSummary: true, trackerTimeRange: 'all' })
  const gameStatTracker = el('tracker', { trackerKitId: 'athlete', trackerConfigId: 'game-stats', trackerTitle: 'Match Stats', trackerColor: '#F59E0B', trackerChartType: 'bar', trackerShowSummary: true, trackerTimeRange: 'all' })

  const tabs = [
    { id: uid('tab'), label: 'Profile', slug: 'profile', sections: [
      makeSection([profileEl]),
      makeSection([jerseyEl]),
    ]},
    { id: uid('tab'), label: 'Performance', slug: 'performance', sections: [
      makeSection([fortyTracker]),
      makeSection([liftTracker]),
      makeSection([bodyTracker]),
      makeSection([workoutEl]),
      makeSection([mealEl]),
    ]},
    { id: uid('tab'), label: 'Stats', slug: 'stats', sections: [
      makeSection([scheduleEl]),
      makeSection([gameStatTracker]),
      makeSection([campTrackerEl]),
    ]},
    { id: uid('tab'), label: 'Highlights', slug: 'highlights', sections: [
      makeSection([
        el('heading', { content: 'Season Highlights', level: 2 }),
        el('text', { content: '<p>Junior year standout: 312 kills, 42 aces, 68 blocks, and a .340 hitting percentage. Named Trinity League First Team All-League and Orange County Register All-County.</p>' }),
        el('kpi', { kpiLabel: 'Kills', kpiValue: '312', kpiTrend: 'up', kpiTrendValue: '+78 from soph yr', kpiColor: 'red' }),
        el('kpi', { kpiLabel: 'Aces', kpiValue: '42', kpiTrend: 'up', kpiTrendValue: '+15', kpiColor: 'green' }),
        el('kpi', { kpiLabel: 'Hitting %', kpiValue: '.340', kpiTrend: 'up', kpiTrendValue: '+.050', kpiColor: 'purple' }),
        el('kpi', { kpiLabel: 'Blocks', kpiValue: '68', kpiTrend: 'up', kpiTrendValue: '+22', kpiColor: 'blue' }),
      ]),
    ]},
    { id: uid('tab'), label: 'About Me', slug: 'about-me', sections: [
      makeSection([
        el('heading', { content: 'About Ava', level: 2 }),
        el('text', { content: '<p>I\'ve been playing volleyball since 7th grade when my mom signed me up for a local club team on a whim. By the end of that first season, I was hooked. There\'s something about the teamwork, the energy of the crowd, and the feeling of a perfect kill that nothing else matches.</p><p>At Mater Dei, I\'m part of one of the top programs in the nation, and competing at this level every day pushes me to be better. Off the court, I have a 3.9 GPA, I\'m VP of the National Honor Society, and I love painting and digital art.</p>' }),
        el('heading', { content: 'My Approach', level: 3 }),
        el('text', { content: '<p>I\'m a six-rotation outside hitter who prides herself on being a complete player. I can score from all positions, serve aggressively, and play strong defense in the back row. My vertical is 10\'2" and improving every month.</p>' }),
        el('heading', { content: 'Goals', level: 3 }),
        el('list', { listType: 'bulleted', listTitle: '', items: ['Commit to a top-10 D1 volleyball program', 'Reach 10\'4" standing reach by senior year', 'Lead Mater Dei to CIF championship', 'All-American honors', 'Study Pre-Med or Biomedical Engineering in college'] }),
      ]),
    ]},
  ]

  return {
    slug: 'ava-thompson-volleyball',
    title: 'Ava Thompson — Volleyball',
    tabs: { enabled: true, tabs, style: 'pills', alignment: 'center' },
    headerCard: {
      enabled: true, template: 'profile',
      name: 'Ava Thompson',
      title: 'Outside Hitter • Class of 2026',
      subtitle: 'Mater Dei High School • Santa Ana, CA',
      photoUrl: '', photoPosition: 'center-overlap',
      actions: [
        { id: uid('action'), label: 'Highlight Tape', url: 'https://youtube.com', icon: 'link', variant: 'solid', color: 'purple' },
        { id: uid('action'), label: 'Email Coach Kim', url: 'mailto:skim@materdei.org', icon: 'mail', variant: 'outline', color: 'green' },
      ],
      textAlignment: 'center',
    },
    kitConfig: { kitId: 'athlete', version: 1, profile: {} },
    sections: tabs[0].sections,
    trackerEntries: {
      fortyYard: buildVolleyballSprintEntries(fortyTracker.id),
      lift: buildVolleyballLiftEntries(liftTracker.id),
      bodyMetrics: buildVolleyballBodyEntries(bodyTracker.id),
      gameStats: buildVolleyballGameStats(gameStatTracker.id),
      campCombine: buildVolleyballCampEntries(campTrackerEl.id),
    },
  }
}

// ─── TRACKER ENTRY BUILDERS ─────────────────────────────────────────────

function buildFortyEntries(trackerId: string) {
  return [
    { trackerId, category: 'sprint', value: { time: 4.68, surface: 'Turf', electronic: true }, recordedAt: new Date('2025-01-15') },
    { trackerId, category: 'sprint', value: { time: 4.65, surface: 'Turf', electronic: true }, recordedAt: new Date('2025-03-01') },
    { trackerId, category: 'sprint', value: { time: 4.61, surface: 'Track', electronic: true }, recordedAt: new Date('2025-05-20') },
    { trackerId, category: 'sprint', value: { time: 4.58, surface: 'Turf', electronic: true }, recordedAt: new Date('2025-07-10') },
    { trackerId, category: 'sprint', value: { time: 4.55, surface: 'Turf', electronic: true }, recordedAt: new Date('2025-09-01') },
  ]
}

function buildLiftEntries(trackerId: string) {
  return [
    { trackerId, category: 'lift', value: { exercise: 'Bench Press', weight: 225, reps: 5, sets: 3, isPR: false }, recordedAt: new Date('2025-01-10') },
    { trackerId, category: 'lift', value: { exercise: 'Squat', weight: 315, reps: 5, sets: 4, isPR: false }, recordedAt: new Date('2025-01-12') },
    { trackerId, category: 'lift', value: { exercise: 'Power Clean', weight: 225, reps: 3, sets: 4, isPR: false }, recordedAt: new Date('2025-02-15') },
    { trackerId, category: 'lift', value: { exercise: 'Bench Press', weight: 245, reps: 3, sets: 3, isPR: true }, recordedAt: new Date('2025-04-01') },
    { trackerId, category: 'lift', value: { exercise: 'Squat', weight: 345, reps: 3, sets: 4, isPR: true }, recordedAt: new Date('2025-05-15') },
    { trackerId, category: 'lift', value: { exercise: 'Deadlift', weight: 385, reps: 3, sets: 3, isPR: false }, recordedAt: new Date('2025-06-20') },
    { trackerId, category: 'lift', value: { exercise: 'Bench Press', weight: 255, reps: 1, sets: 1, isPR: true }, recordedAt: new Date('2025-08-01') },
    { trackerId, category: 'lift', value: { exercise: 'Squat', weight: 365, reps: 1, sets: 1, isPR: true }, recordedAt: new Date('2025-09-10') },
  ]
}

function buildBodyEntries(trackerId: string) {
  return [
    { trackerId, category: 'body-metric', value: { bodyWeight: 195, bodyFat: 14 }, recordedAt: new Date('2025-01-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 198, bodyFat: 13.5 }, recordedAt: new Date('2025-03-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 202, bodyFat: 12.8 }, recordedAt: new Date('2025-05-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 205, bodyFat: 12.2 }, recordedAt: new Date('2025-07-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 205, bodyFat: 11.8 }, recordedAt: new Date('2025-09-01') },
  ]
}

function buildFootballGameStats(trackerId: string) {
  return [
    { trackerId, category: 'game-stat', value: { opponent: 'Lincoln High', result: 'Win', tag: 'Regular Season', stat1: '22/28 passing', stat2: '285 yds', stat3: '3 TDs' }, recordedAt: new Date('2025-08-29') },
    { trackerId, category: 'game-stat', value: { opponent: 'Central Catholic', result: 'Win', tag: 'Regular Season', stat1: '18/25 passing', stat2: '240 yds', stat3: '2 TDs, 1 rush TD' }, recordedAt: new Date('2025-09-05') },
    { trackerId, category: 'game-stat', value: { opponent: 'Jefferson Prep', result: 'Win', tag: 'Regular Season', stat1: '20/24 passing', stat2: '310 yds', stat3: '4 TDs' }, recordedAt: new Date('2025-09-12') },
    { trackerId, category: 'game-stat', value: { opponent: 'St. Xavier', result: 'Loss', tag: 'Rivalry', stat1: '15/30 passing', stat2: '180 yds', stat3: '2 TDs, 2 INTs' }, recordedAt: new Date('2025-09-19') },
    { trackerId, category: 'game-stat', value: { opponent: 'Riverside Academy', result: 'Win', tag: 'Regular Season', stat1: '19/26 passing', stat2: '255 yds', stat3: '3 TDs' }, recordedAt: new Date('2025-09-26') },
    { trackerId, category: 'game-stat', value: { opponent: 'North Valley', result: 'Win', tag: 'Regular Season', stat1: '23/29 passing', stat2: '320 yds', stat3: '4 TDs' }, recordedAt: new Date('2025-10-03') },
  ]
}

function buildFootballCampEntries(trackerId: string) {
  return [
    { trackerId, category: 'camp-combine', value: { eventName: 'Elite 11 Regional', date: '2025-03-15', location: 'Columbus, OH', eventType: 'Combine', resultNotes: 'Top 10 QB, invited to finals' }, recordedAt: new Date('2025-03-15') },
    { trackerId, category: 'camp-combine', value: { eventName: 'Ohio State QB Camp', date: '2025-06-10', location: 'Columbus, OH', eventType: 'Camp', resultNotes: 'Received positive feedback from coaching staff' }, recordedAt: new Date('2025-06-10') },
    { trackerId, category: 'camp-combine', value: { eventName: 'Michigan Prospect Camp', date: '2025-06-18', location: 'Ann Arbor, MI', eventType: 'Camp', resultNotes: 'Named camp MVP — earned offer conversation' }, recordedAt: new Date('2025-06-18') },
  ]
}

// Soccer entries
function buildSoccerSprintEntries(trackerId: string) {
  return [
    { trackerId, category: 'sprint', value: { time: 5.12, surface: 'Grass', electronic: false }, recordedAt: new Date('2025-01-10') },
    { trackerId, category: 'sprint', value: { time: 5.05, surface: 'Grass', electronic: true }, recordedAt: new Date('2025-04-01') },
    { trackerId, category: 'sprint', value: { time: 4.98, surface: 'Turf', electronic: true }, recordedAt: new Date('2025-07-15') },
  ]
}
function buildSoccerLiftEntries(trackerId: string) {
  return [
    { trackerId, category: 'lift', value: { exercise: 'Squat', weight: 155, reps: 8, sets: 3, isPR: false }, recordedAt: new Date('2025-01-15') },
    { trackerId, category: 'lift', value: { exercise: 'Deadlift', weight: 175, reps: 5, sets: 3, isPR: false }, recordedAt: new Date('2025-02-20') },
    { trackerId, category: 'lift', value: { exercise: 'Squat', weight: 175, reps: 5, sets: 4, isPR: true }, recordedAt: new Date('2025-05-01') },
    { trackerId, category: 'lift', value: { exercise: 'Deadlift', weight: 195, reps: 5, sets: 3, isPR: true }, recordedAt: new Date('2025-07-10') },
  ]
}
function buildSoccerBodyEntries(trackerId: string) {
  return [
    { trackerId, category: 'body-metric', value: { bodyWeight: 132, bodyFat: 16 }, recordedAt: new Date('2025-01-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 134, bodyFat: 15.5 }, recordedAt: new Date('2025-04-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 135, bodyFat: 15 }, recordedAt: new Date('2025-07-01') },
  ]
}
function buildSoccerGameStats(trackerId: string) {
  return [
    { trackerId, category: 'game-stat', value: { opponent: 'Coral Glades', result: 'Win', tag: 'Regular Season', stat1: '1 goal', stat2: '2 assists', stat3: '89% pass' }, recordedAt: new Date('2025-02-15') },
    { trackerId, category: 'game-stat', value: { opponent: 'Stoneman Douglas', result: 'Win', tag: 'Regular Season', stat1: '1 goal', stat2: '0 assists', stat3: '91% pass' }, recordedAt: new Date('2025-02-20') },
    { trackerId, category: 'game-stat', value: { opponent: 'Western High', result: 'Tie', tag: 'Regular Season', stat1: '0 goals', stat2: '1 assist', stat3: '85% pass' }, recordedAt: new Date('2025-02-27') },
    { trackerId, category: 'game-stat', value: { opponent: 'St. Thomas Aquinas', result: 'Win', tag: 'Rivalry', stat1: '2 goals', stat2: '1 assist', stat3: '88% pass' }, recordedAt: new Date('2025-03-06') },
    { trackerId, category: 'game-stat', value: { opponent: 'Plantation High', result: 'Win', tag: 'Regular Season', stat1: '3 goals', stat2: '1 assist', stat3: '92% pass' }, recordedAt: new Date('2025-03-13') },
  ]
}
function buildSoccerCampEntries(trackerId: string) {
  return [
    { trackerId, category: 'camp-combine', value: { eventName: 'ECNL National Selection', date: '2025-01-20', location: 'Orlando, FL', eventType: 'Showcase', resultNotes: 'Selected for All-Star match' }, recordedAt: new Date('2025-01-20') },
    { trackerId, category: 'camp-combine', value: { eventName: 'UNC Soccer Camp', date: '2025-06-22', location: 'Chapel Hill, NC', eventType: 'Camp', resultNotes: 'Standout performer, coach follow-up email' }, recordedAt: new Date('2025-06-22') },
  ]
}

// Volleyball entries
function buildVolleyballSprintEntries(trackerId: string) {
  return [
    { trackerId, category: 'sprint', value: { time: 5.05, surface: 'Indoor', electronic: true }, recordedAt: new Date('2025-01-08') },
    { trackerId, category: 'sprint', value: { time: 4.95, surface: 'Indoor', electronic: true }, recordedAt: new Date('2025-05-15') },
    { trackerId, category: 'sprint', value: { time: 4.88, surface: 'Indoor', electronic: true }, recordedAt: new Date('2025-08-20') },
  ]
}
function buildVolleyballLiftEntries(trackerId: string) {
  return [
    { trackerId, category: 'lift', value: { exercise: 'Squat', weight: 175, reps: 5, sets: 4, isPR: false }, recordedAt: new Date('2025-01-10') },
    { trackerId, category: 'lift', value: { exercise: 'Deadlift', weight: 205, reps: 5, sets: 3, isPR: false }, recordedAt: new Date('2025-02-15') },
    { trackerId, category: 'lift', value: { exercise: 'Squat', weight: 195, reps: 5, sets: 4, isPR: true }, recordedAt: new Date('2025-05-01') },
    { trackerId, category: 'lift', value: { exercise: 'Overhead Press', weight: 85, reps: 8, sets: 3, isPR: false }, recordedAt: new Date('2025-06-01') },
    { trackerId, category: 'lift', value: { exercise: 'Deadlift', weight: 225, reps: 3, sets: 3, isPR: true }, recordedAt: new Date('2025-08-10') },
  ]
}
function buildVolleyballBodyEntries(trackerId: string) {
  return [
    { trackerId, category: 'body-metric', value: { bodyWeight: 155, bodyFat: 18 }, recordedAt: new Date('2025-01-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 158, bodyFat: 17 }, recordedAt: new Date('2025-05-01') },
    { trackerId, category: 'body-metric', value: { bodyWeight: 160, bodyFat: 16.5 }, recordedAt: new Date('2025-09-01') },
  ]
}
function buildVolleyballGameStats(trackerId: string) {
  return [
    { trackerId, category: 'game-stat', value: { opponent: 'JSerra Catholic', result: 'Win', tag: 'Regular Season', stat1: '18 kills', stat2: '3 aces', stat3: '4 blocks' }, recordedAt: new Date('2025-08-26') },
    { trackerId, category: 'game-stat', value: { opponent: 'Orange Lutheran', result: 'Win', tag: 'Regular Season', stat1: '15 kills', stat2: '5 aces', stat3: '2 blocks' }, recordedAt: new Date('2025-09-02') },
    { trackerId, category: 'game-stat', value: { opponent: "St. Margaret's", result: 'Win', tag: 'Regular Season', stat1: '22 kills', stat2: '2 aces', stat3: '6 blocks' }, recordedAt: new Date('2025-09-09') },
    { trackerId, category: 'game-stat', value: { opponent: 'Marymount', result: 'Win', tag: 'Regular Season', stat1: '14 kills', stat2: '4 aces', stat3: '3 blocks' }, recordedAt: new Date('2025-09-16') },
    { trackerId, category: 'game-stat', value: { opponent: 'Rosary Academy', result: 'Win', tag: 'Regular Season', stat1: '20 kills', stat2: '3 aces', stat3: '5 blocks' }, recordedAt: new Date('2025-09-23') },
    { trackerId, category: 'game-stat', value: { opponent: 'Santa Margarita', result: 'Loss', tag: 'Rivalry', stat1: '16 kills', stat2: '1 ace', stat3: '4 blocks' }, recordedAt: new Date('2025-09-30') },
  ]
}
function buildVolleyballCampEntries(trackerId: string) {
  return [
    { trackerId, category: 'camp-combine', value: { eventName: 'USA Volleyball HP Camp', date: '2025-02-10', location: 'Anaheim, CA', eventType: 'Camp', resultNotes: 'Named to watch list' }, recordedAt: new Date('2025-02-10') },
    { trackerId, category: 'camp-combine', value: { eventName: 'Nebraska VB Prospect Camp', date: '2025-06-15', location: 'Lincoln, NE', eventType: 'Camp', resultNotes: 'Top outside hitter in camp' }, recordedAt: new Date('2025-06-15') },
    { trackerId, category: 'camp-combine', value: { eventName: 'Under Armour All-America Tryout', date: '2025-07-20', location: 'Orlando, FL', eventType: 'Tryout', resultNotes: 'Made semifinal round' }, recordedAt: new Date('2025-07-20') },
  ]
}

// ─── MAIN SEED FUNCTION ─────────────────────────────────────────────────

async function main() {
  console.log('🏈⚽🏐 Seeding 3 demo athlete profiles...\n')

  const password = await hash('demo1234', 12)

  const profiles = [
    { username: 'marcusjohnson', email: 'marcus@demo.gallio.app', name: 'Marcus Johnson', builder: buildFootballProfile },
    { username: 'sofiareyes', email: 'sofia@demo.gallio.app', name: 'Sofia Reyes', builder: buildSoccerProfile },
    { username: 'avathompson', email: 'ava@demo.gallio.app', name: 'Ava Thompson', builder: buildVolleyballProfile },
  ]

  for (const { username, email, name, builder } of profiles) {
    console.log(`Creating ${name}...`)

    // Upsert user
    const user = await db.user.upsert({
      where: { username },
      update: { name, email, password },
      create: { username, email, name, password },
    })

    const data = builder()

    // Delete existing display with this slug if any
    await db.display.deleteMany({ where: { userId: user.id, slug: data.slug } })

    // Create display
    const display = await db.display.create({
      data: {
        slug: data.slug,
        title: data.title,
        published: true,
        userId: user.id,
        sections: JSON.stringify(data.sections),
        tabs: JSON.stringify(data.tabs),
        headerCard: JSON.stringify(data.headerCard),
        kitConfig: JSON.stringify(data.kitConfig),
      },
    })

    // Create tracker entries
    const allEntries = [
      ...data.trackerEntries.fortyYard,
      ...data.trackerEntries.lift,
      ...data.trackerEntries.bodyMetrics,
      ...data.trackerEntries.gameStats,
      ...data.trackerEntries.campCombine,
    ]

    for (const entry of allEntries) {
      await db.trackerEntry.create({
        data: {
          displayId: display.id,
          trackerId: entry.trackerId,
          category: entry.category,
          value: entry.value as any,
          recordedAt: entry.recordedAt,
        },
      })
    }

    console.log(`  ✓ ${name} → /${username}/${data.slug} (${allEntries.length} tracker entries)`)
  }

  console.log('\n✅ All 3 demo profiles seeded!')
  console.log('\nView them at:')
  console.log('  http://localhost:3001/marcusjohnson/marcus-johnson-qb')
  console.log('  http://localhost:3001/sofiareyes/sofia-reyes-soccer')
  console.log('  http://localhost:3001/avathompson/ava-thompson-volleyball')
  console.log('\nLogin: any demo email + password: demo1234')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
