Create a new typescript cli for interacting with slack. It should live in a nori-slack-cli folder.

The primary consumer of the typescript cli is a coding agent (like yourself).
This means:
- no interactive prompts
- no ascii graphics
- extremely detailed help messages -- every error should suggest alternatives

The cli should map 1:1 to the existing bolt api. BE EXHAUSTIVE. We want the
agent to have full access. Controls are managed through token scopes and NOT
through the code.

The cli must use a bot token, NOT user oauth, since again there will not be a user in the loop.

The cli will be distributed as source, NOT as a compiled app through npm.
- When built, it should automatically add itself to the bash path
- It should indicate to the agent where the source lives on any error so the agent can dig deeper

When complete, move the APPLICATION-SPEC.md and any other spec md files to a nori-slack-cli/spec folder.
