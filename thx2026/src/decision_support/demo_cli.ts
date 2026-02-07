import { demoBeds, demoConfig, demoGridMap, demoPatients, nurseStart } from './demo_data';
import { recommendBeds } from './bed_recommender';

function runDemo() {
  const patientEntries = Object.entries(demoPatients);
  for (const [key, patient] of patientEntries) {
    const { recommendations, excluded } = recommendBeds(patient, demoBeds, nurseStart, demoGridMap, demoConfig);
    console.log(`\nPatient scenario: ${key}`);
    console.log('Top beds:');
    recommendations.forEach((rec, idx) => {
      console.log(`#${idx + 1} bed ${rec.bed_id} (room ${rec.room_id}) score=${rec.score_total.toFixed(1)} cost=${rec.travel_cost}`);
      console.log('  breakdown', rec.score_breakdown);
      console.log('  path', rec.path);
      if (rec.notes.length) console.log('  notes', rec.notes.join('; '));
    });
    if (excluded.length) {
      console.log('Excluded:', excluded);
    }
  }
}

runDemo();
