# Kilocode Change Marking Guidelines

We are a fork of Roo. We regularly merge in the Roo codebase. To enable us to merge more easily, we mark all
our own changes with `kilocode_change` comments.

## Basic Usage

### Single Line Changes

For single line changes, add the comment at the end of the line:

```typescript
let i = 2 // kilocode_change
```

### Multi-line Changes

For multiple consecutive lines, wrap them with start/end comments:

```typescript
// forked_change start
let i = 2
let j = 3
// forked_change end
```

## Language-Specific Examples

### HTML/JSX/TSX

```html
{/* forked_change start */}
<CustomKiloComponent />
{/* forked_change end */}
```

### CSS/SCSS

```css
/* kilocode_change */
.kilocode-specific-class {
	color: blue;
}

/* forked_change start */
.another-class {
	background: red;
}
/* forked_change end */
```

## Special Cases

### Kilocode specific file

- if the filename or directory name contains kilocode no marking with comments is required
- if the file lives inside of the jetbrains/ or cli/ root folder, no marking with comments is required

### New Files

If you're creating a completely new file that doesn't exist in Roo, add this comment at the top:

```
// kilocode_change - new file
```
