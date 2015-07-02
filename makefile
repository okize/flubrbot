default:
	@echo "transpiling es6..."
	@cat app.es6 | babel --optional runtime > app.js
