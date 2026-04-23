PORT := 4200

.PHONY: help start forward-port

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  start        Run Next.js dev server on port $(PORT)"
	@echo "  forward-port Create cloudflared tunnel (http2) → localhost:$(PORT)"
	@echo "  help         Show this help message"

start:
	@python3 killport.py $(PORT) 2>/dev/null || true
	@sleep 0.5
	npx next dev --port $(PORT)

forward-port:
	cloudflared tunnel --protocol http2 --url http://localhost:$(PORT)
