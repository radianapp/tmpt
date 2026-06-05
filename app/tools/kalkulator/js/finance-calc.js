/* app/tools/kalkulator/js/finance-calc.js */

export function calculateLoan(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100;
  const n = tenureMonths;
  
  let emi = 0;
  if (r > 0) {
    emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  } else {
    emi = principal / n;
  }

  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;

  // Amortization schedule
  const schedule = [];
  let balance = principal;
  for (let i = 1; i <= n; i++) {
    const interestPaid = balance * r;
    const principalPaid = emi - interestPaid;
    const endingBalance = balance - principalPaid;
    
    schedule.push({
      month: i,
      beginningBalance: balance,
      emi,
      principalPaid,
      interestPaid,
      endingBalance: endingBalance < 0 ? 0 : endingBalance
    });
    balance = endingBalance;
  }

  return {
    emi,
    totalPayment,
    totalInterest,
    schedule
  };
}

export function calculateCompoundInterest(principal, rate, years, frequency, monthlyContrib = 0) {
  const r = rate / 100;
  const t = years;
  
  // compounding intervals per year
  let n = 12; // default monthly
  if (frequency === 'yearly') n = 1;
  if (frequency === 'daily') n = 365;

  let balance = principal;
  let totalContribution = principal;
  const monthlyRates = r / 12;
  const totalMonths = t * 12;
  const breakdown = [];

  for (let month = 1; month <= totalMonths; month++) {
    // Interest earned in this month
    const interest = balance * monthlyRates;
    balance += interest;
    
    if (monthlyContrib > 0) {
      balance += monthlyContrib;
      totalContribution += monthlyContrib;
    }

    // Save annual snapshot
    if (month % 12 === 0) {
      breakdown.push({
        year: month / 12,
        balance,
        totalContribution,
        totalInterest: balance - totalContribution
      });
    }
  }

  return {
    finalBalance: balance,
    totalContribution,
    totalInterest: balance - totalContribution,
    breakdown
  };
}

export function calculateROI(initialValue, endValue, years = null) {
  const gain = endValue - initialValue;
  const roi = (gain / initialValue) * 100;
  
  let annualizedRoi = null;
  if (years && years > 0) {
    annualizedRoi = (Math.pow(endValue / initialValue, 1 / years) - 1) * 100;
  }

  return {
    gain,
    roi,
    annualizedRoi
  };
}

export function calculatePPh21(grossMonthlySalary, ptkpKey, allowancesMonthly = 0, deductionsMonthly = 0) {
  const ptkpRates = {
    'TK/0': 54000000,
    'TK/1': 58500000,
    'TK/2': 63000000,
    'TK/3': 67500000,
    'K/0': 58500000,
    'K/1': 63000000,
    'K/2': 67500000,
    'K/3': 72000000
  };

  const ptkpLimit = ptkpRates[ptkpKey] || ptkpRates['TK/0'];
  const grossAnnual = (grossMonthlySalary + allowancesMonthly) * 12;
  
  // Deductions: Biaya Jabatan (5% of gross, max 6,000,000 per year or 500,000 per month)
  let jabatanAnnual = grossAnnual * 0.05;
  if (jabatanAnnual > 6000000) jabatanAnnual = 6000000;
  
  const deductionsAnnual = deductionsMonthly * 12 + jabatanAnnual;
  const netAnnual = grossAnnual - deductionsAnnual;
  
  // Taxable income (PKP)
  let pkp = netAnnual - ptkpLimit;
  if (pkp < 0) pkp = 0;

  // Progressive Tax Bracket (UU Harmonisasi Peraturan Perpajakan / HPP)
  // Up to 60jt: 5%
  // 60jt - 250jt: 15%
  // 250jt - 500jt: 25%
  // 500jt - 5M: 30%
  // Above 5M: 35%
  let annualTax = 0;
  let remainingPkp = pkp;

  const brackets = [
    { limit: 60000000, rate: 0.05 },
    { limit: 190000000, rate: 0.15 }, // 250jt - 60jt = 190jt
    { limit: 250000000, rate: 0.25 }, // 500jt - 250jt = 250jt
    { limit: 4500000000, rate: 0.30 }, // 5M - 500jt = 4.5M
    { limit: Infinity, rate: 0.35 }
  ];

  for (const b of brackets) {
    if (remainingPkp > 0) {
      const taxableAmount = Math.min(remainingPkp, b.limit);
      annualTax += taxableAmount * b.rate;
      remainingPkp -= taxableAmount;
    } else {
      break;
    }
  }

  return {
    grossAnnual,
    deductionsAnnual,
    netAnnual,
    ptkpLimit,
    pkp,
    annualTax,
    monthlyTax: annualTax / 12
  };
}
