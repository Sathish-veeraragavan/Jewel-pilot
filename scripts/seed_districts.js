/**
 * Database Seeder: Indian States Districts Roster
 * Populates complete districts for TN, MH, KA, GJ, TS, DL, KL states in Supabase.
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load Environment variables
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valParts] = trimmed.split("=");
      if (key && valParts.length > 0) process.env[key.trim()] = valParts.join("=").trim();
    }
  }
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Districts map per state code
const DISTRICTS_DATA = {
  TN: [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", 
    "Dindigul", "Erode", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", 
    "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", 
    "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", 
    "Thanjavur", "Theni", "Thiruvallur", "Thiruvarur", "Thoothukudi", "Tiruchirappalli", 
    "Tirunelveli", "Tirupattur", "Tiruppur", "Tiruvannamalai", "Vellore", "Viluppuram", 
    "Virudhunagar", "Kallakurichi"
  ],
  KA: [
    "Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", 
    "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", 
    "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", 
    "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", 
    "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", 
    "Yadgir", "Vijayanagara"
  ],
  TS: [
    "Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", 
    "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", 
    "Khammam", "Komaram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", 
    "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", 
    "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", 
    "Rajanna Sircilla", "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet", 
    "Vikarabad", "Wanaparthy", "Warangal", "Hanamkonda", "Yadadri Bhuvanagiri"
  ],
  KL: [
    "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", 
    "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", 
    "Thiruvananthapuram", "Thrissur", "Wayanad"
  ],
  DL: [
    "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", 
    "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", 
    "South West Delhi", "West Delhi"
  ],
  GJ: [
    "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", 
    "Bhavnagar", "Botad", "Chhota Udepur", "Dahod", "Dang", "Devbhumi Dwarka", 
    "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", 
    "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", 
    "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", 
    "Tapi", "Vadodara", "Valsad"
  ],
  MH: [
    "Ahmednagar", "Akola", "Amravati", "Beed", "Bhandara", "Buldhana", 
    "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", 
    "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", 
    "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", 
    "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", 
    "Solapur", "Thane", "Wardha", "Washim", "Yavatmal", "Chhatrapati Sambhajinagar"
  ]
};

async function seedDistricts() {
  console.log("Fetching states master records...");
  const { data: states, error: statesErr } = await supabaseAdmin
    .from("states")
    .select("id, name, code");

  if (statesErr) {
    console.error("Failed to fetch states:", statesErr);
    return;
  }

  console.log(`Loaded ${states.length} states from database.`);

  const insertData = [];

  for (const state of states) {
    // Normalize code (DL code might have "DL font" or similar tailing chars)
    const cleanCode = state.code.substring(0, 2).toUpperCase();
    const districts = DISTRICTS_DATA[cleanCode];

    if (!districts) {
      console.log(`No district seeding mapping found for state code: ${state.code} (${state.name})`);
      continue;
    }

    console.log(`Queueing ${districts.length} districts for ${state.name} (${cleanCode})...`);

    districts.forEach(d => {
      insertData.push({
        state_id: state.id,
        name: d
      });
    });
  }

  if (insertData.length === 0) {
    console.log("No new districts to seed.");
    return;
  }

  console.log(`Upserting ${insertData.length} districts into the database...`);

  // Insert on conflict do nothing / upsert
  const { error: insertErr } = await supabaseAdmin
    .from("districts")
    .upsert(insertData, { onConflict: "state_id, name" });

  if (insertErr) {
    console.error("Seeding failed:", insertErr);
  } else {
    console.log("Successfully seeded all districts!");
  }
}

seedDistricts();
