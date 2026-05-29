const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Show the helper code starting from line 2300 of the pristine Git version
  const rawHelpers = execSync('git show HEAD:src/components/reports/FinalReportGenerator.tsx', { encoding: 'utf8' });
  const lines = rawHelpers.split('\n');
  
  // Find where our helper components are
  const helperStartIndex = lines.findIndex(l => l.includes('function SectionAccordion') || l.includes('SectionAccordion('));
  
  if (helperStartIndex !== -1) {
    const helperCode = lines.slice(helperStartIndex).join('\n');
    fs.writeFileSync('src/components/reports/helper-defs.txt', helperCode, 'utf8');
    console.log('Helpers retrieved successfully! Saved to helper-defs.txt');
  } else {
    // If not found, let's grab from line 2350 onwards
    const helperCode = lines.slice(Math.min(2350, lines.length - 150)).join('\n');
    fs.writeFileSync('src/components/reports/helper-defs.txt', helperCode, 'utf8');
    console.log('Helpers fallback retrieved successfully! Saved to helper-defs.txt');
  }
} catch (e) {
  console.log('Error running git show helper retrieval:', e.message);
}
