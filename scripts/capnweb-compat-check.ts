/**
 * Capnweb Build Compatibility Check
 * 
 * Validates that our build configuration remains compatible with capnweb
 * to ensure smooth integration and prevent silent divergence.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

interface CompatibilityCheck {
  name: string;
  status: 'aligned' | 'compatible' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface CapnwebConfig {
  nodeEngines: string;
  typescriptVersion: string;
  moduleType: 'esm' | 'cjs';
  moduleResolution: string;
  jsTarget: string;
  buildTool: string;
}

interface OurConfig {
  nodeEngines: string;
  typescriptVersion: string;
  moduleType: 'esm' | 'cjs';
  moduleResolution: string;
  jsTarget: string;
  buildTool: string;
}

/**
 * Read and parse package.json files
 */
function readPackageJson(path: string): any {
  try {
    const content = readFileSync(resolve(__dirname, path), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read ${path}:`, error);
    return null;
  }
}

/**
 * Read and parse tsconfig.json files
 */
function readTsconfigJson(path: string): any {
  try {
    const content = readFileSync(resolve(__dirname, path), 'utf-8');
    // Remove comments for JSON parsing
    const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error(`Failed to read ${path}:`, error);
    return null;
  }
}

/**
 * Get capnweb configuration from manifest
 */
function getCapnwebConfig(): CapnwebConfig {
  // These values should match what's documented in .github/a2a-spec-sources.manifest.md
  return {
    nodeEngines: '>=18',
    typescriptVersion: '^5.9.3',
    moduleType: 'esm',
    moduleResolution: 'NodeNext',
    jsTarget: 'ES2020',
    buildTool: 'tsup'
  };
}

/**
 * Get our current configuration
 */
function getOurConfig(): OurConfig {
  const rootPackageJson = readPackageJson('../package.json');
  const rootTsconfig = readTsconfigJson('../tsconfig.json');
  
  if (!rootPackageJson || !rootTsconfig) {
    throw new Error('Failed to read configuration files');
  }

  return {
    nodeEngines: rootPackageJson.engines?.node || '',
    typescriptVersion: rootPackageJson.devDependencies?.typescript || '',
    moduleType: 'esm', // We use "type": "module" in package.json
    moduleResolution: rootTsconfig.compilerOptions?.moduleResolution || '',
    jsTarget: rootTsconfig.compilerOptions?.target || '',
    buildTool: 'tsc' // We use TypeScript compiler
  };
}

/**
 * Perform compatibility checks
 */
function performCompatibilityChecks(capnweb: CapnwebConfig, ours: OurConfig): CompatibilityCheck[] {
  const checks: CompatibilityCheck[] = [];

  // Node Engines Check
  const nodeCheck = checkNodeEngines(capnweb.nodeEngines, ours.nodeEngines);
  checks.push(nodeCheck);

  // TypeScript Version Check
  const tsCheck = checkTypeScriptVersion(capnweb.typescriptVersion, ours.typescriptVersion);
  checks.push(tsCheck);

  // Module System Check
  const moduleCheck = checkModuleSystem(capnweb.moduleType, ours.moduleType);
  checks.push(moduleCheck);

  // Module Resolution Check
  const resolutionCheck = checkModuleResolution(capnweb.moduleResolution, ours.moduleResolution);
  checks.push(resolutionCheck);

  // JS Target Check
  const targetCheck = checkJsTarget(capnweb.jsTarget, ours.jsTarget);
  checks.push(targetCheck);

  // Build Tool Check (informational)
  const buildToolCheck = checkBuildTool(capnweb.buildTool, ours.buildTool);
  checks.push(buildToolCheck);

  return checks;
}

/**
 * Check Node engines compatibility
 */
function checkNodeEngines(capnweb: string, ours: string): CompatibilityCheck {
  if (ours === capnweb) {
    return {
      name: 'Node Engines',
      status: 'aligned',
      message: `Node engines aligned: ${ours}`
    };
  }

  // Check if our minimum is at least capnweb's minimum
  const capnwebMin = parseNodeVersion(capnweb);
  const ourMin = parseNodeVersion(ours);

  if (ourMin >= capnwebMin) {
    return {
      name: 'Node Engines',
      status: 'compatible',
      message: `Our Node ${ours} is compatible with capnweb's ${capnweb}`,
      details: `Our minimum version meets or exceeds capnweb's requirement`
    };
  }

  return {
    name: 'Node Engines',
    status: 'error',
    message: `Node engines incompatible: we require ${ours}, capnweb requires ${capnweb}`,
    details: 'Our minimum Node version is lower than capnweb\'s requirement'
  };
}

/**
 * Parse Node version string to number for comparison
 */
function parseNodeVersion(version: string): number {
  const match = version.match(/>=?(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check TypeScript version compatibility
 */
function checkTypeScriptVersion(capnweb: string, ours: string): CompatibilityCheck {
  const capnwebMajor = extractMajorVersion(capnweb);
  const ourMajor = extractMajorVersion(ours);

  if (capnwebMajor === ourMajor) {
    return {
      name: 'TypeScript Version',
      status: 'aligned',
      message: `TypeScript versions aligned: ${ours}`
    };
  }

  if (ourMajor >= capnwebMajor) {
    return {
      name: 'TypeScript Version',
      status: 'compatible',
      message: `Our TypeScript ${ours} is compatible with capnweb's ${capnweb}`,
      details: 'Our version is newer but should be backward compatible'
    };
  }

  return {
    name: 'TypeScript Version',
    status: 'warning',
    message: `TypeScript version mismatch: we use ${ours}, capnweb uses ${capnweb}`,
    details: 'Our version is older and may lack features capnweb expects'
  };
}

/**
 * Extract major version from semver string
 */
function extractMajorVersion(version: string): number {
  const match = version.match(/\^(\d+)\./);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check module system compatibility
 */
function checkModuleSystem(capnweb: 'esm' | 'cjs', ours: 'esm' | 'cjs'): CompatibilityCheck {
  if (ours === capnweb) {
    return {
      name: 'Module System',
      status: 'aligned',
      message: `Module systems aligned: ${ours.toUpperCase()}`
    };
  }

  return {
    name: 'Module System',
    status: 'error',
    message: `Module system mismatch: we use ${ours.toUpperCase()}, capnweb uses ${capnweb.toUpperCase()}`,
    details: 'This is a significant compatibility issue that needs immediate attention'
  };
}

/**
 * Check module resolution compatibility
 */
function checkModuleResolution(capnweb: string, ours: string): CompatibilityCheck {
  if (ours.toLowerCase() === capnweb.toLowerCase()) {
    return {
      name: 'Module Resolution',
      status: 'aligned',
      message: `Module resolution aligned: ${ours}`
    };
  }

  return {
    name: 'Module Resolution',
    status: 'warning',
    message: `Module resolution difference: we use ${ours}, capnweb uses ${capnweb}`,
    details: 'May cause import resolution issues; test thoroughly'
  };
}

/**
 * Check JavaScript target compatibility
 */
function checkJsTarget(capnweb: string, ours: string): CompatibilityCheck {
  const capnwebYear = extractYearFromTarget(capnweb);
  const ourYear = extractYearFromTarget(ours);

  if (capnwebYear === ourYear) {
    return {
      name: 'JavaScript Target',
      status: 'aligned',
      message: `JavaScript targets aligned: ${ours}`
    };
  }

  if (ourYear >= capnwebYear) {
    return {
      name: 'JavaScript Target',
      status: 'compatible',
      message: `Our target ${ours} is compatible with capnweb's ${capnweb}`,
      details: 'Our target is newer but should be backward compatible'
    };
  }

  return {
    name: 'JavaScript Target',
    status: 'warning',
    message: `JavaScript target older: we use ${ours}, capnweb uses ${capnweb}`,
    details: 'Our target is older and may not support features capnweb uses'
  };
}

/**
 * Extract year from ES target string
 */
function extractYearFromTarget(target: string): number {
  const match = target.match(/ES(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check build tool compatibility (informational)
 */
function checkBuildTool(capnweb: string, ours: string): CompatibilityCheck {
  if (ours === capnweb) {
    return {
      name: 'Build Tool',
      status: 'aligned',
      message: `Build tools aligned: ${ours}`
    };
  }

  return {
    name: 'Build Tool',
    status: 'warning',
    message: `Different build tools: we use ${ours}, capnweb uses ${capnweb}`,
    details: 'Different approach but should be functionally equivalent'
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Checking capnweb build compatibility...\n');

  try {
    const capnwebConfig = getCapnwebConfig();
    const ourConfig = getOurConfig();

    console.log('📋 Configuration Comparison:');
    console.log('  capnweb:', JSON.stringify(capnwebConfig, null, 2));
    console.log('  ours:   ', JSON.stringify(ourConfig, null, 2));
    console.log();

    const checks = performCompatibilityChecks(capnwebConfig, ourConfig);

    console.log('🔍 Compatibility Check Results:');
    console.log();

    let hasErrors = false;
    let hasWarnings = false;

    checks.forEach(check => {
      const statusIcon = {
        aligned: '✅',
        compatible: '✓',
        warning: '⚠️',
        error: '❌'
      }[check.status];

      console.log(`${statusIcon} ${check.name}: ${check.message}`);
      if (check.details) {
        console.log(`   ${check.details}`);
      }
      console.log();

      if (check.status === 'error') hasErrors = true;
      if (check.status === 'warning') hasWarnings = true;
    });

    console.log('📊 Summary:');
    const aligned = checks.filter(c => c.status === 'aligned').length;
    const compatible = checks.filter(c => c.status === 'compatible').length;
    const warnings = checks.filter(c => c.status === 'warning').length;
    const errors = checks.filter(c => c.status === 'error').length;

    console.log(`  ✅ Aligned: ${aligned}`);
    console.log(`  ✓ Compatible: ${compatible}`);
    console.log(`  ⚠️  Warnings: ${warnings}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log();

    if (hasErrors) {
      console.log('❌ Build compatibility check FAILED!');
      console.log('Please address the errors above before proceeding.');
      process.exit(1);
    }

    if (hasWarnings) {
      console.log('⚠️  Build compatibility check passed with warnings.');
      console.log('Review the warnings above, but you may proceed.');
    } else {
      console.log('✅ Build compatibility check PASSED!');
      console.log('Your configuration is aligned with capnweb requirements.');
    }

  } catch (error) {
    console.error('❌ Error during compatibility check:', error);
    process.exit(1);
  }
}

// Run the check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}