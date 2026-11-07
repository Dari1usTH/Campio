// Package backend exposes embedded static assets of the module.
package backend

import _ "embed"

// OpenAPISpec is the OpenAPI 3.1 document served at GET /api/openapi.yaml.
//
//go:embed openapi.yaml
var OpenAPISpec []byte
