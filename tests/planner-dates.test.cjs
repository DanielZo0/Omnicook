require('./register-ts.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {calendarDate,weekDates,shiftWeek}=require('../src/lib/planner/dates.ts');
test('planner validates real dates and handles leap and year boundaries',()=>{
 assert.equal(calendarDate('2024-02-29'),'2024-02-29');
 for(const x of ['0000-01-01','2025-02-29','2026-04-31','2026-13-01','2026-1-01'])assert.throws(()=>calendarDate(x));
 assert.deepEqual(weekDates('2027-01-03'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
 assert.equal(shiftWeek('2026-12-28',1),'2027-01-04');
});
test('calendar results are timezone-independent and Monday anchored',()=>{
 const old=process.env.TZ;
 for(const tz of ['Pacific/Auckland','America/Los_Angeles','Europe/Malta']){process.env.TZ=tz;assert.equal(weekDates('2026-10-25')[0],'2026-10-19');}
 process.env.TZ=old;
});
