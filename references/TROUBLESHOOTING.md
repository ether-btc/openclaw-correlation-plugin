# Troubleshooting

## Failsafe Checklist

### Pre-Deployment Validation
- [ ] Backup current OpenClaw configuration
- [ ] Verify OpenClaw version compatibility (>= 2026.1.26)
- [ ] Test plugin installation in isolated environment
- [ ] Validate correlation rules JSON syntax
- [ ] Document rollback procedure

### Deployment Verification
- [ ] Confirm plugin loads without errors
- [ ] Test basic correlation functionality
- [ ] Verify no performance degradation
- [ ] Check gateway logs for warnings
- [ ] Validate rule matching behavior

### Post-Deployment Monitoring
- [ ] Monitor memory usage
- [ ] Check for unexpected correlations
- [ ] Review user feedback
- [ ] Validate production rule effectiveness

## Error Classification

### Critical Errors (Immediate Rollback)
- Gateway fails to start
- Memory corruption detected
- Performance degradation >50%
- Security violations

### Major Errors (Investigate Within 24 Hours)
- Incorrect correlation results
- Performance degradation 20–50%
- Configuration conflicts
- User experience issues

### Minor Errors (Monitor and Address)
- Minor performance impact (<20%)
- Non-critical logging issues
- Cosmetic display problems
- Documentation inconsistencies

## Rollback Procedure

```bash
# Stop gateway
openclaw gateway stop

# Restore from backup
cp ~/.openclaw/openclaw.json.backup ~/.openclaw/openclaw.json

# Restart
openclaw gateway start
```

## Diagnostic Commands

```bash
# Check gateway status
openclaw gateway status

# View recent logs
openclaw logs --lines 100

# Validate configuration
openclaw doctor

# Test correlation manually
openclaw exec correlation_check --context "your-test-context"
```

## Common Issues

### Plugin not loading
- Check OpenClaw version compatibility (>= 2026.1.26)
- Verify plugin directory structure
- Confirm `correlation-memory` is in `plugins.allow`

### No correlations returned
- Validate correlation rules JSON syntax
- Check rule confidence thresholds
- Verify matching mode settings

### Performance issues
- Review correlation rule complexity
- Check for circular dependencies
- Monitor memory usage patterns

### Rule fires but fetches nothing
- Most common: `must_also_fetch` context files don't exist in `memory/`
- Run `ls memory/` and verify every referenced context exists
- Create missing files or remove the reference

### Rule doesn't fire when it should
1. Check `trigger_keywords` appear in the context string
2. Check `lifecycle.state` — `proposal` rules need explicit opt-in
3. Try `correlation_check` directly:
   ```bash
   openclaw exec correlation_check --context "your context here"
   ```
4. Higher-confidence rules may dominate lower ones

### Duplicate results
Two rules firing on same context with overlapping `must_also_fetch` lists.
- Review both rules for keyword overlap
- Narrow keywords on one rule, or reduce its confidence

### Too much noise
Rule fires on almost every query.
- Narrow the keyword list
- Raise the confidence threshold
- Rule with `confidence: 0.70` firing constantly → reduce to `0.50` or remove
