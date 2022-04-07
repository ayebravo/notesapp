import React, { useEffect, useReducer } from "react";
import { API } from "aws-amplify";

// CSS framework antd
import { List, Input, Button } from "antd";
import "antd/dist/antd.min.css";

// UUID library => Used to create a unique identifier for the client
import { v4 as uuid } from "uuid";

// GraphQL
import { listNotes } from "./graphql/queries";
import {
	createNote as CreateNote,
	deleteNote as DeleteNote,
	updateNote as UpdateNote,
} from "./graphql/mutations";
import { onCreateNote } from "./graphql/subscriptions";

const CLIENT_ID = uuid();

const initialState = {
	notes: [],
	loading: true,
	error: false,
	form: { name: "", description: "" },
};

// One function to change any state in my app
const reducer = (state, action) => {
	switch (action.type) {
		case "SET_NOTES":
			return { ...state, notes: action.notes, loading: false };
		case "ERROR":
			return { ...state, loading: false, error: true };
		case "ADD_NOTE":
			return { ...state, notes: [action.note, ...state.notes] };
		case "RESET_FORM":
			return { ...state, form: initialState.form };
		case "SET_INPUT":
			return {
				...state,
				form: { ...state.form, [action.name]: action.value },
			};
		case "ADD_EXCLAMATION":
			return {
				...state,
				notes: state.notes.map((note) => {
					if (note === action.noteToEmphasize) {
						note.name = note.name.concat("!");
					}
					return note;
				}),
			};
		case "REMOVE_EXCLAMATION":
			return {
				...state,
				notes: state.notes.map((note) => {
					if (note === action.noteToEmphasize) {
						note.name = note.name.replace("!", "");
					}
					return note;
				}),
			};

		default:
			return {
				...state,
			};
	}
};

const App = () => {
	const [state, dispatch] = useReducer(reducer, initialState);

	const createNote = async () => {
		const { form } = state; // pulling out the current form data in the state object
		if (!form.name || !form.description) {
			return alert("please enter a name and description");
		}

		const note = {
			...form, // spreading the current name and description
			clientId: CLIENT_ID,
			completed: false,
			id: uuid(),
		};

		dispatch({ type: "RESET_FORM" });

		try {
			await API.graphql({
				query: CreateNote,
				variables: { input: note },
			});
			console.log("successfully created note!");
		} catch (err) {
			console.error("error: ", err);
		}
	};

	const deleteNote = async (noteToDelete) => {
		// Optimistically update state and screen
		dispatch({
			type: "SET_NOTES",
			notes: state.notes.filter((x) => x !== noteToDelete),
		});

		// Then do the delete via GraphQL mutation
		try {
			await API.graphql({
				query: DeleteNote,
				variables: {
					input: {
						id: noteToDelete.id,
					},
				},
			});
			console.log("successfully deleted note!");
		} catch (err) {
			console.error(err);
		}
	};

	const updateNote = async (noteToUpdate) => {
		// Update the state and display optimistically
		dispatch({
			type: "SET_NOTES",
			notes: state.notes.map((x) => ({
				...x, // Spread current properties of the note
				completed: x === noteToUpdate ? !x.completed : x.completed, // Set the completed property for all the notes but only toggle it for the noteToUpdate
			})),
		});

		// Then call the backend
		try {
			await API.graphql({
				query: UpdateNote,
				variables: {
					input: {
						id: noteToUpdate.id,
						completed: !noteToUpdate.completed,
					},
				},
			});
			console.log("successfully updated note!");
		} catch (err) {
			console.error(err);
		}
	};

	const onChange = (e) => {
		dispatch({
			type: "SET_INPUT",
			name: e.target.name,
			value: e.target.value,
		});
	};

	const addExclamationToName = async (noteToEmphasize) => {
		// Update note's name optimistically
		dispatch({
			type: "ADD_EXCLAMATION",
			noteToEmphasize: noteToEmphasize,
		});

		// Then call the backend
		try {
			await API.graphql({
				query: UpdateNote,
				variables: {
					input: {
						id: noteToEmphasize.id,
						name: noteToEmphasize.name,
					},
				},
			});
			console.log("successfully added a ! to the note's name");
		} catch (err) {
			console.error(err);
		}
	};

	const removeExclamationFromName = async (noteToEmphasize) => {
		// Update note's name optimistically
		dispatch({
			type: "REMOVE_EXCLAMATION",
			noteToEmphasize: noteToEmphasize,
		});

		// Then call the backend
		try {
			await API.graphql({
				query: UpdateNote,
				variables: {
					input: {
						id: noteToEmphasize.id,
						name: noteToEmphasize.name,
					},
				},
			});
			console.log("successfully removed a ! to the note's name");
		} catch (err) {
			console.error(err);
		}
	};

	const fetchNotes = async () => {
		try {
			const notesData = await API.graphql({
				query: listNotes,
			});
			dispatch({
				type: "SET_NOTES",
				notes: notesData.data.listNotes.items,
			});
		} catch (err) {
			console.error("error: ", err);
			dispatch({ type: "ERROR" });
		}
	};

	useEffect(() => {
		fetchNotes();
		const subscription = API.graphql({
			query: onCreateNote,
		}).subscribe({
			next: (noteData) => {
				const note = noteData.value.data.onCreateNote;

				dispatch({ type: "ADD_NOTE", note: note });
			},
		});

		// Pass a clean-up function to React
		return () => subscription.unsubscribe();
	}, []);

	const renderItem = (item) => {
		return (
			<List.Item
				style={styles.item}
				actions={[
					<p style={styles.p} onClick={() => deleteNote(item)}>
						Delete
					</p>,
					<p style={styles.p} onClick={() => updateNote(item)}>
						{item.completed ? "Mark incomplete" : "Mark complete"}
					</p>,
					<p
						style={styles.p}
						onClick={() => addExclamationToName(item)}>
						+!
					</p>,
					<p
						style={styles.p}
						onClick={() => removeExclamationFromName(item)}>
						-!
					</p>,
				]}>
				<List.Item.Meta
					title={`${item.name}${
						item.completed ? " (completed)" : ""
					}`}
					description={item.description}
				/>
			</List.Item>
		);
	};

	return (
		<div style={styles.container}>
			<Input
				onChange={onChange}
				value={state.form.name}
				placeholder="Enter note name"
				name="name"
				style={styles.input}
			/>
			<Input
				onChange={onChange}
				value={state.form.description}
				placeholder="Enter note description"
				name="description"
				style={styles.input}
			/>
			<Button onClick={createNote} type="primary">
				Create Note
			</Button>
			<hr />
			<h3>
				{state.notes.filter((note) => note.completed === true).length}{" "}
				completed / {state.notes.length} total
			</h3>
			<hr />
			<List
				loading={state.loading}
				dataSource={state.notes}
				renderItem={renderItem}
			/>
		</div>
	);
};

const styles = {
	container: { padding: 20 },
	input: { marginBottom: 10 },
	item: { textAlign: "left" },
	p: { color: "#1890ff" },
};

export default App;
