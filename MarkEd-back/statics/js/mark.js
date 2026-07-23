let qNum = document.getElementById("question-num-el")

function setQ(qnum) {
    console.log(document.getElementById("question-num-el"))
    qNum.textContent = document.getElementById("question-num-el")
    console.log(qNum.textContent)
}


    var exampleModal = document.getElementById('exampleModal')
    console.log(exampleModal)
    exampleModal.addEventListener('show.bs.modal', function (event) {
      // Button that triggered the modal
      var button = event.relatedTarget
      // Extract info from data-bs-* attributes
      var recipient = button.getAttribute('data-bs-whatever')
        console.log(recipient)
        console.log(button.getAttribute('data-bs-whatever'))
      // If necessary, you could initiate an AJAX request here
      // and then do the updating in a callback.
      //
      // Update the modal's content.
      var modalTitle = exampleModal.querySelector('.modal-title')
      var modalBodyInput = exampleModal.querySelector('.modal-body input')

  modalTitle.textContent = 'New message to ' + recipient
  modalBodyInput.value = recipient
    })