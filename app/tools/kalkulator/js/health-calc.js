/* app/tools/kalkulator/js/health-calc.js */

export function calculateBMI(weightKg, heightCm) {
  if (heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  
  let category = '';
  if (bmi < 18.5) {
    category = 'Kekurangan Berat Badan (Underweight)';
  } else if (bmi >= 18.5 && bmi < 25) {
    category = 'Berat Badan Normal (Ideal)';
  } else if (bmi >= 25 && bmi < 30) {
    category = 'Kelebihan Berat Badan (Overweight)';
  } else {
    category = 'Obesitas (Obese)';
  }

  const minIdeal = 18.5 * (heightM * heightM);
  const maxIdeal = 24.9 * (heightM * heightM);

  return {
    value: parseFloat(bmi.toFixed(1)),
    category,
    idealRange: {
      min: parseFloat(minIdeal.toFixed(1)),
      max: parseFloat(maxIdeal.toFixed(1))
    }
  };
}

export function calculateBMR(weightKg, heightCm, age, gender, activityLevel) {
  // Mifflin-St Jeor Formula
  let bmr = 0;
  if (gender === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };

  const factor = multipliers[activityLevel] || 1.2;
  const tdee = bmr * factor;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    loseWeightSlow: Math.round(tdee - 250),
    loseWeightFast: Math.round(tdee - 500),
    gainWeight: Math.round(tdee + 500)
  };
}
