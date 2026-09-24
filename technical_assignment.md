Shopify Technical Assignment: FAQ Manager
Full Stack Shopify Developer
Objective
Build and deploy a small embedded Shopify admin app that provides a clear visual interface for managing FAQ entries stored as Shopify metaobjects.
Timebox
Spend no more than 3 hours on the assignment. Prioritize a working embedded app, real Shopify data, one create or edit flow, and deployment. Stop when the time is up. If anything remains unfinished, explain what is missing and how you would complete it.
Starting point
Starting conditions:
Access to our Shopify Partner organization and a development store.
You are responsible for creating the Next.js and TypeScript Shopify app, including setup, authentication, and connection to the Shopify GraphQL Admin API. Use Claude Code, Codex, or another AI coding agent to accelerate the work.
An existing merchant-owned metaobject definition with type faq_item.
Several sample FAQ entries.
FAQ data
Each faq_item contains:
question: required, single-line text.
answer: required, multi-line text.
category: optional, single-line text.
active: boolean.
Core functionality and priorities
Create a Next.js and TypeScript Shopify app and make it open as an embedded interface inside Shopify Admin.
Display up to 50 FAQ entries in a table.
Show the question, category, and active status.
If the core application is complete, add search by question.
If the core application is complete, add filters for category and active status. Client-side filtering is acceptable.
Allow the user to create a new FAQ entry.
Allow the user to edit an existing FAQ entry.
Read and save real data through the Shopify GraphQL Admin API. Do not use mock data for the finished app.
Include loading, empty, validation, success, and API error states.
Interface expectations
Use Shopify Polaris components or an equivalent Shopify-aligned interface.
Keep the layout simple and easy to understand.
Use a table for the database view and a modal or separate page for create and edit.
The interface does not need custom branding or advanced visual design.
AI-assisted coding
Using Claude Code, Codex, or another AI coding agent is required. Creating the Shopify app, solving authentication issues, implementing the interface, and debugging with AI are part of the assignment. We want to see that you can work quickly while keeping control over quality.
In the README, include:
Which AI tools you used.
Two or three examples of tasks or prompts you gave the AI.
One example of AI-generated code that you reviewed or changed.
How you verified that the generated code was correct and secure.
You do not need to share your full AI conversation history.
Deployment
Deploy the application using a hosting provider of your choice.
Install it on the provided Shopify development store.
Keep secrets and access tokens in environment variables. Do not commit them to the repository.
Deliverables
GitHub repository with the source code.
A deployed app installed and working on the provided development store.
A short README with setup instructions, architecture notes, limitations, and the AI usage section.
A 2 to 3 minute screen recording that demonstrates the app and one create or edit flow.
Out of scope
Production-grade multi-store authentication beyond what is required for the provided development store.
Creating the metaobject definition.
External databases, webhooks, billing, theme extensions, and rich-text editing.
Advanced permissions, bulk actions, and production infrastructure.
Optional bonus
If time remains, implement only one of the following:
Delete or duplicate an FAQ entry.
Pagination.
Optimistic UI updates.
One meaningful automated test.
What we evaluate
Correct use of Shopify metaobjects and GraphQL.
Usability and completeness of the admin interface.
Code quality, structure, and TypeScript usage.
Validation and handling of real application states.
Ability to use Claude Code or Codex productively, debug the app, and verify generated code.
Submission
Send us the GitHub repository and screen-recording links, and confirm that the app is installed on the development store.

