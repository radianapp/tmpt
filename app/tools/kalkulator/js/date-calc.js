/* app/tools/kalkulator/js/date-calc.js */

export function calculateAge(birthDateStr, targetDateStr = null) {
  const birthDate = new Date(birthDateStr);
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

  if (isNaN(birthDate.getTime()) || isNaN(targetDate.getTime())) return null;

  let years = targetDate.getFullYear() - birthDate.getFullYear();
  let months = targetDate.getMonth() - birthDate.getMonth();
  let days = targetDate.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  // Days lived
  const diffTime = targetDate.getTime() - birthDate.getTime();
  const daysLived = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Next Birthday countdown
  const nextBD = new Date(targetDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (nextBD < targetDate) {
    nextBD.setFullYear(targetDate.getFullYear() + 1);
  }
  const nextBDDiff = nextBD.getTime() - targetDate.getTime();
  const daysToNextBD = Math.ceil(nextBDDiff / (1000 * 60 * 60 * 24));

  // Day of birth
  const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const birthDayOfWeek = daysOfWeek[birthDate.getDay()];

  return {
    years,
    months,
    days,
    daysLived,
    daysToNextBD,
    birthDayOfWeek
  };
}

export function calculateDateDiff(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  const diffTime = end.getTime() - start.getTime();
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diffTime / (1000 * 60 * 60));
  const minutes = Math.floor(diffTime / (1000 * 60));

  // Count business days (exclude Sat & Sun)
  let businessDays = 0;
  let weekends = 0;
  let tempDate = new Date(start.getTime());
  
  while (tempDate <= end) {
    const day = tempDate.getDay();
    if (day === 0 || day === 6) {
      weekends++;
    } else {
      businessDays++;
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }

  return {
    totalDays,
    businessDays,
    weekends,
    hours,
    minutes
  };
}
