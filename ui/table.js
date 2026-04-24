export function createTable(columns = [], data = []) {
  /*
    columns = [
      { key: "name", label: "الاسم" },
      { key: "employeeId", label: "الرقم" }
    ]

    data = [
      { name: "Ahmed", employeeId: "1001" }
    ]
  */

  let html = `
    <table>
      <thead>
        <tr>
  `;

  // Headers
  columns.forEach(col => {
    html += `<th>${col.label}</th>`;
  });

  html += `
        </tr>
      </thead>
      <tbody>
  `;

  // Rows
  data.forEach(row => {
    html += `<tr>`;

    columns.forEach(col => {
      html += `<td>${row[col.key] ?? "-"}</td>`;
    });

    html += `</tr>`;
  });

  html += `
      </tbody>
    </table>
  `;

  return html;
}
