import { describe, expect, it } from 'vitest'
import { describeError } from '../src/renderer/src/i18n'

describe('describeError', () => {
  it('translates engine error codes for both languages', () => {
    expect(
      describeError(
        'zh',
        "Error invoking remote method 'sources:add': dest-conflicts-source: /tmp/x",
      ),
    ).toBe('这个位置是另一个文件的原件，备份会把它覆盖')
    expect(describeError('en', 'dest-conflicts-destination: /tmp/x')).toBe(
      'That location is already used by another backup task',
    )
    expect(describeError('en', 'dest-same-as-source: /tmp/x')).toBe(
      'The copy location cannot be the source file itself',
    )
    expect(describeError('zh', 'duplicate-basename: same.txt')).toBe('同名文件不能放进同一个文件夹')
    expect(describeError('en', 'source-not-file: /tmp')).toBe(
      'Anshin v0.1 backs up single files only',
    )
  })

  it('translates recorded errno codes', () => {
    expect(describeError('zh', 'errno:ENOENT')).toBe('找不到源文件，可能已被移动或删除')
    expect(describeError('en', 'errno:ENOSPC')).toBe('The destination disk is full')
    expect(describeError('en', 'errno:EACCES')).toBe(
      'No permission to read or write that location; check the file and folder permissions',
    )
    expect(describeError('zh', 'errno:EPERM')).toBe(
      '没有权限读写这个位置，请检查文件和文件夹的权限',
    )
  })

  it('falls back to the raw message when nothing matches', () => {
    expect(describeError('zh', 'something unexpected')).toBe('something unexpected')
    expect(describeError('en', 'errno:EXDEV')).toBe('errno:EXDEV')
  })
})
