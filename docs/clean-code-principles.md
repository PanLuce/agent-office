# Clean Code Principles

Reference guide for code review. The Reviewer agent reads this before reviewing code.

## SOLID Principles

- **Single Responsibility**: Each class/function has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes must be substitutable for base types
- **Interface Segregation**: Clients shouldn't depend on unused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

## Naming Conventions

- Use intention-revealing names that explain WHY, not just WHAT
- Avoid mental mapping and abbreviations
- Use searchable names for important variables
- Class names: nouns (Customer, Account)
- Method names: verbs (getName, calculateTotal)
- Boolean variables: is/has/can prefixes

## Functions

- Keep functions small (ideally < 20 lines)
- Do one thing only
- Use descriptive names over comments
- Minimize parameters (max 3-4)
- Avoid flag arguments (boolean parameters)
- No side effects
- Command Query Separation: functions either do something OR return something

## Comments

- Code should be self-documenting
- Good code > good comments
- Explain WHY, not WHAT
- Remove commented-out code

## Error Handling

- Use exceptions, not return codes
- Write try-catch-finally first
- Provide context with exceptions
- Don't return null - use Optional, empty objects, or exceptions
- Don't ignore caught exceptions

## Types

- Don't use "any" types

## Code Structure

- Organize code top-to-bottom (newspaper metaphor)
- Keep related concepts close together
- Use consistent indentation and formatting
- Remove dead code immediately
- Follow team conventions consistently

## Classes and Objects

- Keep classes small and focused
- Minimize public interface
- Organize methods by abstraction level
- Use composition over inheritance
- Hide implementation details

## Testing Principles

- Write tests first (TDD)
- One assertion per test
- Fast, Independent, Repeatable, Self-validating, Timely (FIRST)
- Test behavior, not implementation
- Avoid brittle tests
- Avoid redundant tests

## Code Quality Metrics

- Cyclomatic complexity < 10
- Method length < 20 lines
- Class length < 300 lines
- Parameter count < 4
- Test coverage > 80%

## Refactoring Red Flags

- Long methods/classes
- Duplicate code
- Large parameter lists
- Feature envy
- Data clumps
- Primitive obsession
- Switch statements
