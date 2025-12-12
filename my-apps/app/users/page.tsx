
export default async function usersPage() {
    console.log("Contact page loaded");
    const response = await fetch('https://jsonplaceholder.typicode.com/users');
    const users = await response.json()
    
    console.log("Contact page loaded");
    return (
        <main>
            <h1>Users list</h1>
            <br />
            <ul>
                {users.map(
                    (user: { id: number; name: string } ) => (
                        <li key={user.id}>
                            <h1>{user.name}</h1>
                        </li>
                ))}
            </ul>
        </main>
    );

}