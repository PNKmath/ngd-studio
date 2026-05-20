// Stage 4: checker autofix actually fixes run-on equation in real XML
import { runCheckerWithAutoFix } from "/Users/junhyukpark/ngd/ngd-studio/ngd-studio/server/stages/checker.ts";
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

// Take real section0.xml from previous build (has run-on cases pre-task).
// Use the pretask-built HWPX which has run-on equations.
const PRE_XML = "/tmp/stage3-pre-unz/Contents/section0.xml";
const xml = readFileSync(PRE_XML, "utf8");

// Count run-on equations (>=2 `=` in script)
const scripts = xml.match(/<hp:script>([^<]+)<\/hp:script>/g) ?? [];
const runOn = scripts.filter(s => {
  const inner = s.replace(/^<hp:script>|<\/hp:script>$/g, "");
  return (inner.match(/=/g)?.length ?? 0) >= 2;
});
console.log(`PRE section0.xml: ${scripts.length} scripts, ${runOn.length} run-on (>=2 '=')`);

// Build a tiny temp HWPX with just the section so checker can read it via path.
// Easier: just call runDeterministicCheckerRules directly which takes XML string.
import { runDeterministicCheckerRules, fixRunOnEquationsInXml } from "/Users/junhyukpark/ngd/ngd-studio/ngd-studio/server/stages/checker.ts";

const issuesBefore = runDeterministicCheckerRules(xml);
const runOnIssues = issuesBefore.filter(i => i.ruleId === "equation.run_on");
console.log(`Detected run-on issues: ${runOnIssues.length}`);

const fixedXml = fixRunOnEquationsInXml(xml);
const fixedScripts = fixedXml.match(/<hp:script>([^<]+)<\/hp:script>/g) ?? [];
const stillRunOn = fixedScripts.filter(s => {
  const inner = s.replace(/^<hp:script>|<\/hp:script>$/g, "");
  return (inner.match(/=/g)?.length ?? 0) >= 2;
});

const issuesAfter = runDeterministicCheckerRules(fixedXml);
const runOnIssuesAfter = issuesAfter.filter(i => i.ruleId === "equation.run_on");

console.log(`\n=== Stage 4: Checker Autofix on Real XML ===`);
console.log(`Before fix: ${scripts.length} scripts, ${runOn.length} run-on, ${runOnIssues.length} issues`);
console.log(`After fix:  ${fixedScripts.length} scripts, ${stillRunOn.length} run-on, ${runOnIssuesAfter.length} issues`);
console.log(`Net script count change (split effect): ${fixedScripts.length - scripts.length}`);
if (runOnIssuesAfter.length === 0 && runOnIssues.length > 0) {
  console.log(`\n✓ All ${runOnIssues.length} run-on equations were split`);
} else if (runOnIssues.length === 0) {
  console.log(`\n(input had no run-on; nothing to verify)`);
} else {
  console.log(`\n✗ ${runOnIssuesAfter.length} run-on remain after fix`);
}
