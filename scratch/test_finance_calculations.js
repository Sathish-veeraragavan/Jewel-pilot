// Finance division and settlement calculation verification script

const testCollections = [
  { amount: 15000, payment_status: "Collected" },
  { amount: 12000, payment_status: "Collected" },
  { amount: 5000, payment_status: "Pending" } // should not be counted
];

const testExpenses = [
  { amount: 2500, description: "Server renewal" },
  { amount: 1500, description: "API fees" }
];

const testReserves = [
  { amount: 3000, held_by: "Sathish" },
  { amount: 2000, held_by: "Company" }
];

const testSettlements = [
  { amount: 2000, partner_name: "Sathish" },
  { amount: 4000, partner_name: "Sankar" }
];

function runTest() {
  console.log("--- Testing Finance Auto-Division & Settlement Calculations ---");
  
  // Calculate total collected
  const totalCollected = testCollections
    .filter(c => c.payment_status === "Collected")
    .reduce((sum, c) => sum + c.amount, 0);
  
  console.log("Total Collected (Expected: 27000):", totalCollected);
  
  // Calculate total expenses
  const totalExpenses = testExpenses.reduce((sum, e) => sum + e.amount, 0);
  console.log("Total Expenses (Expected: 4000):", totalExpenses);
  
  // Calculate total reserves
  const totalReserves = testReserves.reduce((sum, r) => sum + r.amount, 0);
  console.log("Total Reserves (Expected: 5000):", totalReserves);
  
  // Calculate remaining
  const remaining = Math.max(0, totalCollected - totalExpenses - totalReserves);
  console.log("Remaining Dividable Profit (Expected: 18000):", remaining);
  
  // Calculate partner share
  const partnerShare = remaining / 3;
  console.log("Partner Share (Expected: 6000 each):", partnerShare);

  // Partner calculations
  const partners = ["Sathish", "Sankar", "Nipin"];
  const partnerBreakdown = partners.map(name => {
    const settled = testSettlements
      .filter(s => s.partner_name.toLowerCase() === name.toLowerCase())
      .reduce((sum, s) => sum + s.amount, 0);

    const pending = partnerShare - settled;

    return {
      name,
      allocated: partnerShare,
      settled,
      pending
    };
  });

  console.log("Partner Breakdown:", JSON.stringify(partnerBreakdown, null, 2));

  // Asserts
  const sathishData = partnerBreakdown.find(p => p.name === "Sathish");
  const sankarData = partnerBreakdown.find(p => p.name === "Sankar");
  const nipinData = partnerBreakdown.find(p => p.name === "Nipin");

  if (sathishData.settled !== 2000 || sathishData.pending !== 4000) throw new Error("Sathish math mismatch");
  if (sankarData.settled !== 4000 || sankarData.pending !== 2000) throw new Error("Sankar math mismatch");
  if (nipinData.settled !== 0 || nipinData.pending !== 6000) throw new Error("Nipin math mismatch");
  
  console.log("\n✓ All partner division and settlement balance math calculations verified successfully!");
}

runTest();
