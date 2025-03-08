export interface Holiday {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  type: 'Regular' | 'Special';
  multiplier: number;
}

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/en.philippines%23holiday%40group.v.calendar.google.com/events';
const API_KEY = 'AIzaSyCgpWYq2DON3a9GA555z5AUOQHAebgGNw0';

export async function fetchHolidays(year: number, regularMultiplier: number = 2, specialMultiplier: number = 1.3): Promise<Holiday[]> {
  try {
    // Create dates in UTC
    const timeMin = new Date(Date.UTC(year, 0, 1));
    const timeMax = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    
    const params = new URLSearchParams({
      key: API_KEY,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100'
    });
    
    const response = await fetch(`${CALENDAR_API_URL}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar API Error:', errorText);
      throw new Error(`Failed to fetch holidays: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.items) {
      console.warn('No holiday items found in response');
      return [];
    }
    
    return data.items.map((event: any) => ({
      id: event.id,
      name: event.summary,
      startDate: new Date(event.start.date || event.start.dateTime),
      endDate: new Date(event.end.date || event.end.dateTime),
      type: event.description?.includes('Special') ? 'Special' : 'Regular',
      multiplier: event.description?.includes('Special') ? specialMultiplier : regularMultiplier,
    }));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    throw error;
  }
}

export function isHoliday(date: Date, holidays: Holiday[]): Holiday | null {
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  return holidays.find(holiday => {
    const holidayStart = new Date(holiday.startDate.getFullYear(), holiday.startDate.getMonth(), holiday.startDate.getDate());
    const holidayEnd = new Date(holiday.endDate.getFullYear(), holiday.endDate.getMonth(), holiday.endDate.getDate());
    return targetDate >= holidayStart && targetDate <= holidayEnd;
  }) || null;
}