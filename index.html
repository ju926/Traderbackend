<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Swaply</title>
</head>
<body>

<h1>Swaply Test</h1>

<form id="form">
  <input type="text" placeholder="Name" id="name" required />
  <input type="text" placeholder="Description" id="desc" required />
  <button type="submit">Upload</button>
</form>

<h2>Items</h2>
<div id="items"></div>

<script>
const API = "http://localhost:5000/items"; // change to Render later

const form = document.getElementById("form");
const itemsDiv = document.getElementById("items");

// POST item
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  await fetch(API, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      name: document.getElementById("name").value,
      description: document.getElementById("desc").value
    })
  });

  loadItems();
});

// GET items
async function loadItems() {
  const res = await fetch(API);
  const data = await res.json();

  itemsDiv.innerHTML = "";

  data.forEach(item => {
    itemsDiv.innerHTML += `
      <p><b>${item.name}</b> - ${item.description}</p>
    `;
  });
}

loadItems();
</script>

</body>
</html>
