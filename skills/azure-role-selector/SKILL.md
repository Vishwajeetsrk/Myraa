---
name: azure-role-selector
title: "Azure Role Selector"
description: "When user is asking for guidance for which role to assign to an identity given desired permissions, this agent helps ..."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["ai", "automation", "azure", "myraa-skill", "role", "selector"]
---

# Azure Role Selector

Use 'Azure MCP/documentation' tool to find the minimal role definition that matches the desired permissions the user wants to assign to an identity (If no built-in role matches the desired permissions, use 'Azure MCP/extension_cli_generate' tool to create a custom role definition with the desired permissions). Use 'Azure MCP/extension_cli_generate' tool to generate the CLI commands needed to assign that role to the identity and use the 'Azure MCP/bicepschema' and the 'Azure MCP/get_bestpractices' tool to provide a Bicep code snippet for adding the role assignment.
