#!/usr/bin/env -S deno run --allow-all

/**
 * Test Runner for Supabase Edge Functions
 * 
 * This script runs all tests for the automated development pipeline
 * and generates comprehensive test reports.
 */

import { parseArgs } from "https://deno.land/std@0.168.0/cli/parse_args.ts"

interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
}

interface TestSuite {
  name: string
  file: string
  results: TestResult[]
  totalDuration: number
  passed: number
  failed: number
  skipped: number
}

class TestRunner {
  private testSuites: TestSuite[] = []
  private verbose = false
  private filter = ''
  private parallel = false

  constructor(options: { verbose?: boolean; filter?: string; parallel?: boolean } = {}) {
    this.verbose = options.verbose || false
    this.filter = options.filter || ''
    this.parallel = options.parallel || false
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Automated Development Pipeline Test Suite\n')

    const testFiles = [
      { name: 'Auth Middleware Tests', file: 'auth-middleware.test.ts' },
      { name: 'Rate Limiter Tests', file: 'rate-limiter.test.ts' },
      { name: 'Pipeline Integration Tests', file: 'pipeline-integration.test.ts' },
      { name: 'Performance Tests', file: 'performance.test.ts' }
    ]

    const startTime = performance.now()

    if (this.parallel) {
      await this.runTestsInParallel(testFiles)
    } else {
      await this.runTestsSequentially(testFiles)
    }

    const totalTime = performance.now() - startTime

    this.generateReport(totalTime)
  }

  private async runTestsSequentially(testFiles: Array<{ name: string; file: string }>): Promise<void> {
    for (const testFile of testFiles) {
      if (this.filter && !testFile.name.toLowerCase().includes(this.filter.toLowerCase())) {
        continue
      }

      await this.runTestSuite(testFile.name, testFile.file)
    }
  }

  private async runTestsInParallel(testFiles: Array<{ name: string; file: string }>): Promise<void> {
    const filteredFiles = testFiles.filter(testFile => 
      !this.filter || testFile.name.toLowerCase().includes(this.filter.toLowerCase())
    )

    const promises = filteredFiles.map(testFile => 
      this.runTestSuite(testFile.name, testFile.file)
    )

    await Promise.all(promises)
  }

  private async runTestSuite(suiteName: string, fileName: string): Promise<void> {
    console.log(`📋 Running ${suiteName}...`)

    const testSuite: TestSuite = {
      name: suiteName,
      file: fileName,
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }

    const startTime = performance.now()

    try {
      // Run Deno test command
      const command = new Deno.Command('deno', {
        args: [
          'test',
          '--allow-all',
          '--reporter=json',
          fileName
        ],
        cwd: Deno.cwd(),
        stdout: 'piped',
        stderr: 'piped'
      })

      const process = command.spawn()
      const { stdout, stderr } = await process.output()
      const success = (await process.status).success

      const output = new TextDecoder().decode(stdout)
      const errorOutput = new TextDecoder().decode(stderr)

      if (this.verbose && errorOutput) {
        console.log(`⚠️  Stderr for ${suiteName}:`, errorOutput)
      }

      // Parse JSON output if available
      try {
        const lines = output.split('\n').filter(line => line.trim())
        for (const line of lines) {
          if (line.startsWith('{')) {
            const testResult = JSON.parse(line)
            if (testResult.type === 'testResult') {
              testSuite.results.push({
                name: testResult.name,
                status: testResult.result === 'ok' ? 'passed' : 'failed',
                duration: testResult.duration || 0,
                error: testResult.result !== 'ok' ? testResult.error : undefined
              })
            }
          }
        }
      } catch (parseError) {
        // Fallback to simple success/failure
        testSuite.results.push({
          name: suiteName,
          status: success ? 'passed' : 'failed',
          duration: 0,
          error: success ? undefined : errorOutput || 'Test failed'
        })
      }

    } catch (error) {
      testSuite.results.push({
        name: suiteName,
        status: 'failed',
        duration: 0,
        error: error.message
      })
    }

    testSuite.totalDuration = performance.now() - startTime

    // Calculate statistics
    testSuite.passed = testSuite.results.filter(r => r.status === 'passed').length
    testSuite.failed = testSuite.results.filter(r => r.status === 'failed').length
    testSuite.skipped = testSuite.results.filter(r => r.status === 'skipped').length

    this.testSuites.push(testSuite)

    // Print immediate results
    const status = testSuite.failed === 0 ? '✅' : '❌'
    const duration = (testSuite.totalDuration / 1000).toFixed(2)
    console.log(`${status} ${suiteName} - ${testSuite.passed} passed, ${testSuite.failed} failed (${duration}s)\n`)

    if (this.verbose && testSuite.failed > 0) {
      testSuite.results.filter(r => r.status === 'failed').forEach(result => {
        console.log(`   ❌ ${result.name}: ${result.error}`)
      })
      console.log()
    }
  }

  private generateReport(totalTime: number): void {
    console.log('📊 Test Results Summary')
    console.log('=' .repeat(50))

    let totalPassed = 0
    let totalFailed = 0
    let totalSkipped = 0

    // Suite-by-suite breakdown
    for (const suite of this.testSuites) {
      const status = suite.failed === 0 ? '✅' : '❌'
      const duration = (suite.totalDuration / 1000).toFixed(2)
      
      console.log(`${status} ${suite.name}`)
      console.log(`   📈 ${suite.passed} passed, ${suite.failed} failed, ${suite.skipped} skipped`)
      console.log(`   ⏱️  Duration: ${duration}s`)
      
      if (suite.failed > 0 && !this.verbose) {
        console.log(`   ❌ Failed tests:`)
        suite.results.filter(r => r.status === 'failed').forEach(result => {
          console.log(`      • ${result.name}`)
        })
      }
      
      console.log()

      totalPassed += suite.passed
      totalFailed += suite.failed
      totalSkipped += suite.skipped
    }

    // Overall summary
    console.log('🎯 Overall Results')
    console.log('-'.repeat(30))
    console.log(`Total Tests: ${totalPassed + totalFailed + totalSkipped}`)
    console.log(`✅ Passed: ${totalPassed}`)
    console.log(`❌ Failed: ${totalFailed}`)
    console.log(`⏭️  Skipped: ${totalSkipped}`)
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`)

    const successRate = totalPassed + totalFailed > 0 
      ? ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)
      : '0'
    console.log(`📊 Success Rate: ${successRate}%`)

    // Performance insights
    this.generatePerformanceInsights()

    // Exit with appropriate code
    if (totalFailed > 0) {
      console.log('\n❌ Some tests failed. Please review the results above.')
      Deno.exit(1)
    } else {
      console.log('\n✅ All tests passed successfully!')
      Deno.exit(0)
    }
  }

  private generatePerformanceInsights(): void {
    console.log('\n⚡ Performance Insights')
    console.log('-'.repeat(30))

    // Find slowest test suites
    const sortedSuites = [...this.testSuites].sort((a, b) => b.totalDuration - a.totalDuration)
    
    console.log('Slowest Test Suites:')
    sortedSuites.slice(0, 3).forEach((suite, index) => {
      const duration = (suite.totalDuration / 1000).toFixed(2)
      console.log(`${index + 1}. ${suite.name}: ${duration}s`)
    })

    // Calculate average test duration
    const totalTests = this.testSuites.reduce((sum, suite) => sum + suite.results.length, 0)
    const totalDuration = this.testSuites.reduce((sum, suite) => sum + suite.totalDuration, 0)
    const avgDuration = totalTests > 0 ? (totalDuration / totalTests / 1000).toFixed(3) : '0'
    
    console.log(`\nAverage Test Duration: ${avgDuration}s`)

    // Test coverage insights
    const testTypes = {
      unit: this.testSuites.filter(s => s.name.includes('Auth') || s.name.includes('Rate')).length,
      integration: this.testSuites.filter(s => s.name.includes('Integration')).length,
      performance: this.testSuites.filter(s => s.name.includes('Performance')).length
    }

    console.log('\nTest Coverage:')
    console.log(`📝 Unit Tests: ${testTypes.unit} suites`)
    console.log(`🔗 Integration Tests: ${testTypes.integration} suites`)
    console.log(`⚡ Performance Tests: ${testTypes.performance} suites`)
  }

  async generateJUnitReport(): Promise<void> {
    const xml = this.generateJUnitXML()
    await Deno.writeTextFile('test-results.xml', xml)
    console.log('📄 JUnit report saved to test-results.xml')
  }

  private generateJUnitXML(): string {
    const totalTests = this.testSuites.reduce((sum, suite) => sum + suite.results.length, 0)
    const totalFailures = this.testSuites.reduce((sum, suite) => sum + suite.failed, 0)
    const totalTime = this.testSuites.reduce((sum, suite) => sum + suite.totalDuration, 0) / 1000

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    xml += `<testsuites tests="${totalTests}" failures="${totalFailures}" time="${totalTime.toFixed(3)}">\n`

    for (const suite of this.testSuites) {
      const suiteTime = (suite.totalDuration / 1000).toFixed(3)
      xml += `  <testsuite name="${suite.name}" tests="${suite.results.length}" failures="${suite.failed}" time="${suiteTime}">\n`

      for (const result of suite.results) {
        const testTime = (result.duration / 1000).toFixed(3)
        xml += `    <testcase name="${result.name}" time="${testTime}">\n`
        
        if (result.status === 'failed') {
          xml += `      <failure message="${result.error || 'Test failed'}">${result.error || 'Test failed'}</failure>\n`
        } else if (result.status === 'skipped') {
          xml += `      <skipped/>\n`
        }
        
        xml += `    </testcase>\n`
      }

      xml += `  </testsuite>\n`
    }

    xml += `</testsuites>\n`
    return xml
  }
}

// Main execution
async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ['help', 'verbose', 'parallel', 'junit'],
    string: ['filter'],
    alias: {
      h: 'help',
      v: 'verbose',
      f: 'filter',
      p: 'parallel',
      j: 'junit'
    }
  })

  if (args.help) {
    console.log(`
🧪 Automated Development Pipeline Test Runner

Usage: deno run --allow-all run-tests.ts [options]

Options:
  -h, --help      Show this help message
  -v, --verbose   Show detailed test output
  -f, --filter    Filter tests by name (case-insensitive)
  -p, --parallel  Run test suites in parallel
  -j, --junit     Generate JUnit XML report

Examples:
  deno run --allow-all run-tests.ts
  deno run --allow-all run-tests.ts --verbose
  deno run --allow-all run-tests.ts --filter "auth"
  deno run --allow-all run-tests.ts --parallel --junit
    `)
    Deno.exit(0)
  }

  const runner = new TestRunner({
    verbose: args.verbose,
    filter: args.filter,
    parallel: args.parallel
  })

  try {
    await runner.runAllTests()
    
    if (args.junit) {
      await runner.generateJUnitReport()
    }
  } catch (error) {
    console.error('❌ Test runner failed:', error.message)
    Deno.exit(1)
  }
}

if (import.meta.main) {
  await main()
}