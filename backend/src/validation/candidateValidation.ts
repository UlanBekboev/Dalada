interface Interval {
  dayOfWeek: number;
  start: string;
  end: string;
}

const isValidTime = (t: string) => {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [hours, minutes] = t.split(':').map(Number);
  return hours !== undefined && minutes !== undefined && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};
const compareTime = (a: string, b: string) => a.localeCompare(b);

export function validateAvailability(anytime: boolean, timezone: string, intervals?: Interval[]) {
  if (!timezone) throw { status: 422, message: 'timezone required' };

  if (anytime) {
    if (intervals && intervals.length > 0) {
      throw { status: 422, message: 'При anytime=true интервалы не допускаются' };
    }
    return;
  }

  if (!intervals || !intervals.length) {
    throw { status: 422, message: 'Необходимо указать интервалы' };
  }
  if (intervals.length > 15) throw { status: 422, message: 'Превышен лимит 15 интервалов' };

  const dayMap: Record<number, { start: string; end: string }[]> = {};
  for (const { dayOfWeek, start, end } of intervals) {
    if (dayOfWeek < 0 || dayOfWeek > 6) throw { status: 422, message: `Неверный день недели: ${dayOfWeek}` };
    if (!isValidTime(start) || !isValidTime(end)) throw { status: 422, message: `Неверный формат времени: ${start}-${end}` };

    if (compareTime(start, end) >= 0) {
      // ночная смена, ок
    }

    if (!dayMap[dayOfWeek]) dayMap[dayOfWeek] = [];
    for (const existing of dayMap[dayOfWeek]) {
      if (!(end <= existing.start || start >= existing.end)) {
        throw { status: 422, message: `Пересечение интервалов в дне ${dayOfWeek}` };
      }
    }
    dayMap[dayOfWeek].push({ start, end });

    if (dayMap[dayOfWeek].length > 3) {
      throw { status: 422, message: `В дне ${dayOfWeek} больше 3 интервалов` };
    }
  }
}