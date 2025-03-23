document.addEventListener("DOMContentLoaded", () => {
    // Add fade-in animation to cards
    const cards = document.querySelectorAll(".card")
    cards.forEach((card, index) => {
      card.style.opacity = "0"
      card.style.transform = "translateY(20px)"
  
      setTimeout(() => {
        card.style.transition = "opacity 0.5s ease, transform 0.5s ease"
        card.style.opacity = "1"
        card.style.transform = "translateY(0)"
      }, 100 * index)
    })
  
    // Flash message auto-dismiss
    const flashMessages = document.querySelectorAll(".message")
    flashMessages.forEach((message) => {
      setTimeout(() => {
        message.style.opacity = "0"
        message.style.height = "0"
        message.style.margin = "0"
        message.style.padding = "0"
        message.style.transition = "all 0.5s ease"
  
        setTimeout(() => {
          message.remove()
        }, 500)
      }, 5000)
    })
  
    // Add hover effect to table rows
    const tableRows = document.querySelectorAll("tbody tr")
    tableRows.forEach((row) => {
      row.addEventListener("mouseenter", () => {
        row.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
      })
  
      row.addEventListener("mouseleave", () => {
        row.style.backgroundColor = ""
      })
    })
  
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll(".btn")
    buttons.forEach((button) => {
      button.addEventListener("click", function (e) {
        const x = e.clientX - e.target.getBoundingClientRect().left
        const y = e.clientY - e.target.getBoundingClientRect().top
  
        const ripple = document.createElement("span")
        ripple.classList.add("ripple")
        ripple.style.left = `${x}px`
        ripple.style.top = `${y}px`
  
        this.appendChild(ripple)
  
        setTimeout(() => {
          ripple.remove()
        }, 600)
      })
    })
  
    // Add CSS for ripple effect
    const style = document.createElement("style")
    style.textContent = `
          .btn {
              position: relative;
              overflow: hidden;
          }
          
          .ripple {
              position: absolute;
              background: rgba(255, 255, 255, 0.3);
              border-radius: 50%;
              transform: scale(0);
              animation: ripple 0.6s linear;
              pointer-events: none;
          }
          
          @keyframes ripple {
              to {
                  transform: scale(4);
                  opacity: 0;
              }
          }
      `
    document.head.appendChild(style)
  })
  
  