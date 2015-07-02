default:
	@echo "transpiling es6..."
	@cat app.es6 | babel > app.js
